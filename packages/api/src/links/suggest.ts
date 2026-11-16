import type { Database } from "@yousiverse/db";
import {
  type LinkKind,
  linkChecks,
  linkSuggestions,
  type MediaType,
  media,
  mediaLinks,
} from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as igdb from "@yousiverse/integrations/igdb";
import { getRelatedTitles, type WikidataRelation } from "@yousiverse/integrations/wikidata";
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** A long-running franchise can connect hundreds of works; a reviewer gets the closest ones. */
const MAX_SUGGESTIONS_PER_TITLE = 30;

const LINK_FOR: Record<WikidataRelation, { kind: LinkKind; reversed: boolean }> = {
  based_on: { kind: "adaptation_of", reversed: false },
  basis_for: { kind: "adaptation_of", reversed: true },
  follows: { kind: "sequel_of", reversed: false },
  followed_by: { kind: "sequel_of", reversed: true },
  same_franchise: { kind: "same_franchise", reversed: false },
};

type Title = { id: string; type: MediaType; providerId: string };
type Suggestion = {
  targetType: MediaType;
  targetProviderId: string;
  targetTitle: string;
  kind: LinkKind;
  reversed: boolean;
};

/** Titles never looked up for suggestions, or not for a month. */
function dueForCheck() {
  const cutoff = new Date(Date.now() - RECHECK_AFTER_MS);
  return and(
    isNotNull(media.providerId),
    or(isNull(linkChecks.checkedAt), lt(linkChecks.checkedAt, cutoff)),
  );
}

export async function countDueForCheck(db: Database): Promise<number> {
  const [due] = await db
    .select({ total: count() })
    .from(media)
    .leftJoin(linkChecks, eq(linkChecks.mediaId, media.id))
    .where(dueForCheck());
  return due?.total ?? 0;
}

/** Asks Wikidata what a title is connected to, and names each connected title by provider id. */
async function findSuggestions(title: Title): Promise<Suggestion[]> {
  const igdbSlug = title.type === "game" ? await igdb.getSlug(title.providerId) : null;
  const related = await getRelatedTitles({ ...title, igdbSlug });

  // Wikidata mostly knows games by IGDB's slug, so those are turned into ids in one request.
  const slugs = related.flatMap((other) =>
    other.type === "game" && !other.providerId && other.igdbSlug ? other.igdbSlug : [],
  );
  const games = await igdb.findBySlugs([...new Set(slugs)].sort());

  const suggestions = new Map<string, Suggestion>();
  for (const other of related) {
    const providerId = other.providerId ?? games.get(other.igdbSlug ?? "")?.providerId;
    const key = `${other.type}:${providerId}`;
    if (!providerId || suggestions.has(key)) continue;
    if (other.type === title.type && providerId === title.providerId) continue;
    suggestions.set(key, {
      targetType: other.type,
      targetProviderId: providerId,
      targetTitle: other.title,
      ...LINK_FOR[other.relation],
    });
  }
  return [...suggestions.values()].slice(0, MAX_SUGGESTIONS_PER_TITLE);
}

/**
 * Drops suggestions that say nothing new: the two titles are already linked, or the same pair
 * was already suggested from the other title's side.
 */
async function withoutKnownPairs(db: Database, title: Title, suggestions: Suggestion[]) {
  if (suggestions.length === 0) return suggestions;
  const stored = await db
    .select({ id: media.id, type: media.type, providerId: media.providerId })
    .from(media)
    .where(
      inArray(
        media.providerId,
        suggestions.map((suggestion) => suggestion.targetProviderId),
      ),
    );
  const targetIds = stored.map((row) => row.id);
  if (targetIds.length === 0) return suggestions;

  const [linked, mirrored] = await Promise.all([
    db
      .select({ fromMediaId: mediaLinks.fromMediaId, toMediaId: mediaLinks.toMediaId })
      .from(mediaLinks)
      .where(
        or(
          and(eq(mediaLinks.fromMediaId, title.id), inArray(mediaLinks.toMediaId, targetIds)),
          and(eq(mediaLinks.toMediaId, title.id), inArray(mediaLinks.fromMediaId, targetIds)),
        ),
      ),
    db
      .select({ mediaId: linkSuggestions.mediaId })
      .from(linkSuggestions)
      .where(
        and(
          inArray(linkSuggestions.mediaId, targetIds),
          eq(linkSuggestions.targetType, title.type),
          eq(linkSuggestions.targetProviderId, title.providerId),
        ),
      ),
  ]);
  const known = new Set([
    ...linked.map((link) => (link.fromMediaId === title.id ? link.toMediaId : link.fromMediaId)),
    ...mirrored.map((suggestion) => suggestion.mediaId),
  ]);
  const knownTargets = new Set(
    stored.filter((row) => known.has(row.id)).map((row) => `${row.type}:${row.providerId}`),
  );
  return suggestions.filter(
    (suggestion) => !knownTargets.has(`${suggestion.targetType}:${suggestion.targetProviderId}`),
  );
}

async function saveCheck(db: Database, title: Title, suggestions: Suggestion[]): Promise<number> {
  return db.transaction(async (tx) => {
    const checkedAt = new Date();
    await tx
      .insert(linkChecks)
      .values({ mediaId: title.id, checkedAt })
      .onConflictDoUpdate({ target: linkChecks.mediaId, set: { checkedAt } });
    if (suggestions.length === 0) return 0;
    const added = await tx
      .insert(linkSuggestions)
      .values(suggestions.map((suggestion) => ({ mediaId: title.id, ...suggestion })))
      .onConflictDoNothing()
      .returning({ id: linkSuggestions.id });
    return added.length;
  });
}

export type CheckResult = {
  /** Titles looked up in this request. */
  checked: number;
  /** New suggestions those titles produced. */
  suggested: number;
  /** Titles whose answer could not be read. They are tried again in a month. */
  unreadable: number;
  /** Titles still waiting to be looked up. */
  remaining: number;
};

/**
 * Looks up the next titles that are due, newest first, and stores what Wikidata suggests for
 * them. Throws a ProviderError when a source cannot be reached, leaving those titles due; `skip`
 * then lets a caller pass over the titles it could not get an answer for.
 */
export async function checkNextTitles(
  db: Database,
  { limit, skip }: { limit: number; skip: number },
): Promise<CheckResult> {
  const due = await db
    .select({ id: media.id, type: media.type, providerId: media.providerId })
    .from(media)
    .leftJoin(linkChecks, eq(linkChecks.mediaId, media.id))
    .where(dueForCheck())
    .orderBy(sql`${linkChecks.checkedAt} asc nulls first`, desc(media.createdAt), media.id)
    .limit(limit)
    .offset(skip);

  const result = { checked: 0, suggested: 0, unreadable: 0 };
  for (const row of due) {
    if (!row.providerId) continue;
    const title = { ...row, providerId: row.providerId };
    let suggestions: Suggestion[] = [];
    try {
      suggestions = await withoutKnownPairs(db, title, await findSuggestions(title));
    } catch (error) {
      const unreadable =
        error instanceof ProviderError &&
        (error.kind === "invalid_response" || error.kind === "not_found");
      if (!unreadable) throw error;
      console.warn(`Could not read link suggestions for ${title.type} ${title.providerId}.`, error);
      result.unreadable += 1;
    }
    result.suggested += await saveCheck(db, title, suggestions);
    result.checked += 1;
  }
  return { ...result, remaining: await countDueForCheck(db) };
}

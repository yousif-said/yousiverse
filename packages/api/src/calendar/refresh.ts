import type { Database } from "@yousiverse/db";
import { libraryEntries, media, tvShows } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { type CatalogRef, ensureImported } from "../catalog/import";
import { inBatches, type StepRunner } from "../step-runner";
import { addDays, usToday } from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A title that may still gain or change dates is fetched again once its copy is this old. */
const REFRESH_OLDER_THAN_MS = 3 * DAY_MS;
/** How many titles one run fetches, so a large import is caught up over days, not at once. */
export const TITLES_PER_RUN = 150;
const TITLES_PER_STEP = 5;
/** A show in one of these states gets no more episodes. */
const FINISHED_SHOW_STATES = ["Ended", "Canceled"];
/** A release date can move until some time after it has passed. */
const DATE_SETTLES_AFTER_DAYS = 30;

/**
 * The titles in people's libraries whose dates could still change: shows that have not ended,
 * and movies and games not yet out, just out, or with no date. Books are left out because their
 * source gives no release dates. The longest unrefreshed come first.
 */
export async function findTitlesToRefresh(db: Database): Promise<CatalogRef[]> {
  const inALibrary = inArray(
    media.id,
    db
      .select({ mediaId: libraryEntries.mediaId })
      .from(libraryEntries)
      .where(ne(libraryEntries.status, "dropped")),
  );
  const stale = or(
    isNull(media.syncedAt),
    lt(media.syncedAt, new Date(Date.now() - REFRESH_OLDER_THAN_MS)),
  );
  const unsettled = or(
    and(
      eq(media.type, "tv"),
      or(isNull(tvShows.status), notInArray(tvShows.status, FINISHED_SHOW_STATES)),
    ),
    and(
      inArray(media.type, ["movie", "game"]),
      or(
        isNull(media.releaseDate),
        gte(media.releaseDate, addDays(usToday(), -DATE_SETTLES_AFTER_DAYS)),
      ),
    ),
  );

  const titles = await db
    .select({ type: media.type, providerId: media.providerId })
    .from(media)
    .leftJoin(tvShows, eq(tvShows.mediaId, media.id))
    .where(and(inALibrary, stale, unsettled, isNotNull(media.providerId)))
    .orderBy(sql`${media.syncedAt} asc nulls first`, asc(media.id))
    .limit(TITLES_PER_RUN);
  return titles.flatMap((title) =>
    title.providerId ? { type: title.type, providerId: title.providerId } : [],
  );
}

/**
 * Fetches the titles' details again. A provider failing on one title is logged and counted, and
 * leaves that title due next time.
 */
export async function refreshTitles(db: Database, titles: CatalogRef[]) {
  const result = { refreshed: 0, failed: 0 };
  for (const title of titles) {
    try {
      await ensureImported(db, title, REFRESH_OLDER_THAN_MS);
      result.refreshed += 1;
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      console.warn(`Could not refresh ${title.type} ${title.providerId} for the calendar.`, error);
      result.failed += 1;
    }
  }
  return result;
}

/** The daily calendar refresh, split into short steps for the job runner. */
export async function runCalendarRefresh(db: Database, runStep: StepRunner) {
  const titles = await runStep("find-titles", () => findTitlesToRefresh(db));
  let refreshed = 0;
  for (const [index, batch] of inBatches(titles, TITLES_PER_STEP).entries()) {
    const result = await runStep(`refresh-${index}`, () => refreshTitles(db, batch));
    refreshed += result.refreshed;
  }
  return { titles: titles.length, refreshed };
}

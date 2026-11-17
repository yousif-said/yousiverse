import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  type LinkKind,
  type LinkSource,
  linkKinds,
  linkSuggestions,
  media,
  mediaLinks,
} from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { ensureImported } from "../catalog/import";
import { parseTitleAddress } from "../links/address";
import { checkNextTitles, countDueForCheck } from "../links/suggest";
import { adminProcedure, isAdmin, publicProcedure, router } from "../trpc";

/** How a linked title relates to the one whose page is open, in the order pages show them. */
export const titleRelations = [
  "based_on",
  "adapted_as",
  "sequel_to",
  "followed_by",
  "same_franchise",
] as const;
export type TitleRelation = (typeof titleRelations)[number];

/** Reads a stored link from one end: `outgoing` when the open title is the link's `from`. */
function relationFor(kind: LinkKind, outgoing: boolean): TitleRelation {
  if (kind === "adaptation_of") return outgoing ? "based_on" : "adapted_as";
  if (kind === "sequel_of") return outgoing ? "sequel_to" : "followed_by";
  return "same_franchise";
}

// Wikidata can take many seconds over one title, so each request looks up only one.
const TITLES_PER_CHECK = 1;
const REVIEW_PAGE_SIZE = 50;

/** Stores a verified link. Answers CONFLICT when the two titles are already linked. */
async function saveLink(
  db: Database,
  link: { fromMediaId: string; toMediaId: string; kind: LinkKind; source: LinkSource },
  verifiedBy: string,
) {
  if (link.fromMediaId === link.toMediaId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A title cannot be linked to itself." });
  }
  const [saved] = await db
    .insert(mediaLinks)
    .values({ ...link, verifiedBy })
    .onConflictDoNothing()
    .returning({ id: mediaLinks.id });
  if (!saved) {
    throw new TRPCError({ code: "CONFLICT", message: "These two titles are already linked." });
  }
  return saved;
}

export const linksRouter = router({
  /** The verified links of a title, each read from that title's side. */
  forTitle: publicProcedure.input(z.object({ mediaId: z.uuid() })).query(async ({ ctx, input }) => {
    const other = alias(media, "other");
    const links = await ctx.db
      .select({
        id: mediaLinks.id,
        kind: mediaLinks.kind,
        fromMediaId: mediaLinks.fromMediaId,
        title: {
          type: other.type,
          providerId: other.providerId,
          title: other.title,
          releaseYear: other.releaseYear,
          posterUrl: other.posterUrl,
        },
      })
      .from(mediaLinks)
      .innerJoin(
        other,
        sql`${other.id} = case when ${mediaLinks.fromMediaId} = ${input.mediaId} then ${mediaLinks.toMediaId} else ${mediaLinks.fromMediaId} end`,
      )
      .where(
        and(
          or(eq(mediaLinks.fromMediaId, input.mediaId), eq(mediaLinks.toMediaId, input.mediaId)),
          isNotNull(other.providerId),
        ),
      )
      .orderBy(asc(other.releaseYear), asc(other.title));

    return links
      .flatMap(({ id, kind, fromMediaId, title }) =>
        title.providerId
          ? {
              id,
              relation: relationFor(kind, fromMediaId === input.mediaId),
              title: { ...title, providerId: title.providerId },
            }
          : [],
      )
      .sort((a, b) => titleRelations.indexOf(a.relation) - titleRelations.indexOf(b.relation));
  }),

  /** Whether the visitor is one of the people who review suggested links. */
  canReview: publicProcedure.query(({ ctx }) => isAdmin(ctx.session)),

  /** The suggestions waiting for a decision, grouped by title, and how much work is left. */
  suggestions: adminProcedure.query(async ({ ctx }) => {
    const [pending, [waiting], uncheckedTitles] = await Promise.all([
      ctx.db
        .select({
          id: linkSuggestions.id,
          kind: linkSuggestions.kind,
          reversed: linkSuggestions.reversed,
          title: {
            type: media.type,
            providerId: media.providerId,
            title: media.title,
            releaseYear: media.releaseYear,
          },
          target: {
            type: linkSuggestions.targetType,
            providerId: linkSuggestions.targetProviderId,
            title: linkSuggestions.targetTitle,
          },
        })
        .from(linkSuggestions)
        .innerJoin(media, eq(media.id, linkSuggestions.mediaId))
        .where(and(eq(linkSuggestions.state, "pending"), isNotNull(media.providerId)))
        // A title's closest connections first: enum order runs from adaptation to franchise.
        .orderBy(
          asc(media.title),
          asc(media.id),
          asc(linkSuggestions.kind),
          asc(linkSuggestions.targetTitle),
          asc(linkSuggestions.id),
        )
        .limit(REVIEW_PAGE_SIZE),
      ctx.db
        .select({ total: count() })
        .from(linkSuggestions)
        .where(eq(linkSuggestions.state, "pending")),
      countDueForCheck(ctx.db),
    ]);
    return {
      pending: pending.flatMap(({ title, ...suggestion }) =>
        title.providerId
          ? { ...suggestion, title: { ...title, providerId: title.providerId } }
          : [],
      ),
      pendingCount: waiting?.total ?? 0,
      uncheckedTitles,
    };
  }),

  /**
   * Looks up the next title that is due for suggestions. Call it again until `checked` is 0.
   * `skip` passes over that many due titles, for when the first ones keep failing.
   */
  check: adminProcedure
    .input(z.object({ skip: z.number().int().min(0).max(10_000).default(0) }).optional())
    .mutation(({ ctx, input }) =>
      checkNextTitles(ctx.db, { limit: TITLES_PER_CHECK, skip: input?.skip ?? 0 }),
    ),

  /** Turns a suggestion into a link everyone can see. */
  approve: adminProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [suggestion] = await ctx.db
      .select()
      .from(linkSuggestions)
      .where(and(eq(linkSuggestions.id, input.id), eq(linkSuggestions.state, "pending")));
    if (!suggestion) throw new TRPCError({ code: "NOT_FOUND" });

    const targetId = await ensureImported(ctx.db, {
      type: suggestion.targetType,
      providerId: suggestion.targetProviderId,
    });
    const [fromMediaId, toMediaId] = suggestion.reversed
      ? [targetId, suggestion.mediaId]
      : [suggestion.mediaId, targetId];
    try {
      await saveLink(
        ctx.db,
        { fromMediaId, toMediaId, kind: suggestion.kind, source: "wikidata" },
        ctx.session.user.id,
      );
    } catch (error) {
      // Already linked some other way: the suggestion is settled either way.
      if (!(error instanceof TRPCError && error.code === "CONFLICT")) throw error;
    }
    await ctx.db
      .update(linkSuggestions)
      .set({ state: "approved", reviewedBy: ctx.session.user.id, reviewedAt: new Date() })
      .where(eq(linkSuggestions.id, suggestion.id));
  }),

  /** Turns a suggestion down. It is kept so the same one is not suggested again. */
  reject: adminProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const rejected = await ctx.db
      .update(linkSuggestions)
      .set({ state: "rejected", reviewedBy: ctx.session.user.id, reviewedAt: new Date() })
      .where(and(eq(linkSuggestions.id, input.id), eq(linkSuggestions.state, "pending")))
      .returning({ id: linkSuggestions.id });
    if (rejected.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),

  /**
   * Links two titles by hand, each named by its page address. The link reads "from is an
   * adaptation of to" or "from is a sequel of to".
   */
  add: adminProcedure
    .input(
      z.object({
        from: z.string().max(300),
        to: z.string().max(300),
        kind: z.enum(linkKinds),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const from = parseTitleAddress(input.from);
      const to = parseTitleAddress(input.to);
      if (!from || !to) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Enter the address of each title's page, like /movies/603.",
        });
      }
      const fromMediaId = await ensureImported(ctx.db, from);
      const toMediaId = await ensureImported(ctx.db, to);
      return saveLink(
        ctx.db,
        { fromMediaId, toMediaId, kind: input.kind, source: "manual" },
        ctx.session.user.id,
      );
    }),

  /** The links most recently verified, for a reviewer to look over or undo. */
  verified: adminProcedure.query(async ({ ctx }) => {
    const from = alias(media, "from_media");
    const to = alias(media, "to_media");
    const links = await ctx.db
      .select({
        id: mediaLinks.id,
        kind: mediaLinks.kind,
        source: mediaLinks.source,
        from: { type: from.type, providerId: from.providerId, title: from.title },
        to: { type: to.type, providerId: to.providerId, title: to.title },
      })
      .from(mediaLinks)
      .innerJoin(from, eq(from.id, mediaLinks.fromMediaId))
      .innerJoin(to, eq(to.id, mediaLinks.toMediaId))
      .orderBy(desc(mediaLinks.createdAt), asc(mediaLinks.id))
      .limit(REVIEW_PAGE_SIZE);
    return links.flatMap((link) =>
      link.from.providerId && link.to.providerId
        ? {
            ...link,
            from: { ...link.from, providerId: link.from.providerId },
            to: { ...link.to, providerId: link.to.providerId },
          }
        : [],
    );
  }),

  /** Removes a verified link. */
  remove: adminProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const removed = await ctx.db
      .delete(mediaLinks)
      .where(eq(mediaLinks.id, input.id))
      .returning({ id: mediaLinks.id });
    if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),
});

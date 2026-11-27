import {
  episodes,
  follows,
  libraryEntries,
  MAX_RATING,
  profiles,
  ratings,
  seasons,
} from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveTarget, type Target, target } from "../targets";
import { type Context, protectedProcedure, publicProcedure, router } from "../trpc";
import { visibleToOthers } from "../visibility";

const MAX_TITLES_ASKED = 300;
/** Ratings are grouped by half point for charts: 0, 0.5, 1 ... 10. */
const HALF_POINTS = MAX_RATING / 2 + 1;

/** Ratings are whole numbers of quarter points: 33 is shown as 8.25. */
const value = z.number().int().min(0).max(MAX_RATING);

/** Ratings of a whole title leave out ratings of its episodes. */
function ratingsOf(target: Target) {
  return "episodeId" in target
    ? eq(ratings.episodeId, target.episodeId)
    : and(eq(ratings.mediaId, target.mediaId), isNull(ratings.episodeId));
}

/** Everyone's ratings summed up, plus the asking person's own. Averages are in quarter points. */
function summaryFields(ctx: Context) {
  // No user has an empty id, so a signed-out visitor matches no rating.
  const userId = ctx.session?.user.id ?? "";
  return {
    average: sql<number | null>`avg(${ratings.value})::float`,
    count: count(ratings.id),
    mine: sql<number | null>`max(${ratings.value}) filter (where ${ratings.userId} = ${userId})`,
  };
}

export const ratingsRouter = router({
  save: protectedProcedure.input(z.object({ target, value })).mutation(async ({ ctx, input }) => {
    const ids = await resolveTarget(ctx.db, input.target);
    await ctx.db
      .insert(ratings)
      .values({ userId: ctx.session.user.id, ...ids, value: input.value })
      .onConflictDoUpdate({
        target: [ratings.userId, ratings.mediaId, ratings.episodeId],
        set: { value: input.value, updatedAt: new Date() },
      });
  }),

  remove: protectedProcedure.input(z.object({ target })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(ratings)
      .where(and(eq(ratings.userId, ctx.session.user.id), ratingsOf(input.target)));
  }),

  summary: publicProcedure.input(z.object({ target })).query(async ({ ctx, input }) => {
    const [summary] = await ctx.db
      .select(summaryFields(ctx))
      .from(ratings)
      .where(ratingsOf(input.target));
    return summary ?? { average: null, count: 0, mine: null };
  }),

  /**
   * How many people gave each half point, 0 to 10: 21 counts. A rating between half points
   * is counted with the half point below it.
   */
  distribution: publicProcedure.input(z.object({ target })).query(async ({ ctx, input }) => {
    const halfPoint = sql<number>`floor(${ratings.value} / 2.0)::int`;
    const rows = await ctx.db
      .select({ halfPoint, count: count() })
      .from(ratings)
      .where(ratingsOf(input.target))
      .groupBy(halfPoint);
    const bars = new Array<number>(HALF_POINTS).fill(0);
    for (const row of rows) bars[row.halfPoint] = row.count;
    return bars;
  }),

  /**
   * What the people the viewer follows rated this, highest first. A person's rating is credited
   * to them only where their library entry for the title is visible to the viewer; otherwise it
   * counts in the average and nowhere else. Empty for a visitor who is not signed in.
   */
  fromFollowing: publicProcedure.input(z.object({ target })).query(async ({ ctx, input }) => {
    const viewerId = ctx.session?.user.id;
    if (!viewerId) return [];
    const followed = ctx.db
      .select({ id: follows.followedId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    return ctx.db
      .select({ username: profiles.username, value: ratings.value })
      .from(ratings)
      .innerJoin(profiles, eq(profiles.userId, ratings.userId))
      .innerJoin(
        libraryEntries,
        and(eq(libraryEntries.userId, ratings.userId), eq(libraryEntries.mediaId, ratings.mediaId)),
      )
      .where(
        and(
          ratingsOf(input.target),
          inArray(ratings.userId, followed),
          visibleToOthers(viewerId, libraryEntries.userId, libraryEntries.visibility),
        ),
      )
      .orderBy(desc(ratings.value), asc(profiles.username));
  }),

  /** The signed-in person's own rating of each of these titles. Unrated titles are left out. */
  mine: protectedProcedure
    .input(z.object({ mediaIds: z.array(z.uuid()).max(MAX_TITLES_ASKED) }))
    .query(async ({ ctx, input }) => {
      if (input.mediaIds.length === 0) return [];
      return ctx.db
        .select({ mediaId: ratings.mediaId, value: ratings.value })
        .from(ratings)
        .where(
          and(
            eq(ratings.userId, ctx.session.user.id),
            inArray(ratings.mediaId, input.mediaIds),
            isNull(ratings.episodeId),
          ),
        );
    }),

  /** Everyone's average for each of these titles. Titles nobody has rated are left out. */
  averages: publicProcedure
    .input(z.object({ mediaIds: z.array(z.uuid()).max(MAX_TITLES_ASKED) }))
    .query(async ({ ctx, input }) => {
      if (input.mediaIds.length === 0) return [];
      return ctx.db
        .select({
          mediaId: ratings.mediaId,
          average: sql<number>`avg(${ratings.value})::float`,
          count: count(),
        })
        .from(ratings)
        .where(and(inArray(ratings.mediaId, input.mediaIds), isNull(ratings.episodeId)))
        .groupBy(ratings.mediaId);
    }),

  /**
   * Ratings of every episode of a show, in one go. Episodes nobody has rated are left out.
   */
  forShow: publicProcedure.input(z.object({ mediaId: z.uuid() })).query(async ({ ctx, input }) => {
    return ctx.db
      .select({ episodeId: episodes.id, ...summaryFields(ctx) })
      .from(ratings)
      .innerJoin(episodes, eq(episodes.id, ratings.episodeId))
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .where(eq(seasons.mediaId, input.mediaId))
      .groupBy(episodes.id);
  }),

  /** Ratings of each episode in a season. Episodes nobody has rated are left out. */
  forSeason: publicProcedure
    .input(z.object({ seasonId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({ episodeId: episodes.id, ...summaryFields(ctx) })
        .from(ratings)
        .innerJoin(episodes, eq(episodes.id, ratings.episodeId))
        .where(eq(episodes.seasonId, input.seasonId))
        .groupBy(episodes.id);
    }),
});

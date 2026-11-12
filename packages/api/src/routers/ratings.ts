import { episodes, MAX_RATING, ratings } from "@yousiverse/db/schema";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveTarget, type Target, target } from "../targets";
import { type Context, protectedProcedure, publicProcedure, router } from "../trpc";

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

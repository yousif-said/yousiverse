import { ratings, reviews, users, visibilities } from "@yousiverse/db/schema";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveTarget, type Target, target } from "../targets";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const MAX_REVIEW_LENGTH = 10_000;
const MAX_REVIEWS_SHOWN = 50;

/** Reviews of a whole title leave out reviews of its episodes. */
function reviewsOf(target: Target) {
  return "episodeId" in target
    ? eq(reviews.episodeId, target.episodeId)
    : and(eq(reviews.mediaId, target.mediaId), isNull(reviews.episodeId));
}

export const reviewsRouter = router({
  /** Writes or rewrites the signed-in person's review. Leaving out `visibility` keeps it as is. */
  save: protectedProcedure
    .input(
      z.object({
        target,
        body: z.string().trim().min(1).max(MAX_REVIEW_LENGTH),
        visibility: z.enum(visibilities).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = await resolveTarget(ctx.db, input.target);
      const changes = { body: input.body, visibility: input.visibility };
      await ctx.db
        .insert(reviews)
        .values({ userId: ctx.session.user.id, ...ids, ...changes })
        .onConflictDoUpdate({
          target: [reviews.userId, reviews.mediaId, reviews.episodeId],
          set: { ...changes, updatedAt: new Date() },
        });
    }),

  remove: protectedProcedure.input(z.object({ target })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(reviews)
      .where(and(eq(reviews.userId, ctx.session.user.id), reviewsOf(input.target)));
  }),

  /**
   * The asking person's own review, whoever can see it, and other people's public reviews,
   * newest first. A private review is never returned to anyone but its author.
   */
  list: publicProcedure.input(z.object({ target })).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user.id;

    const [mine] = userId
      ? await ctx.db
          .select({ body: reviews.body, visibility: reviews.visibility })
          .from(reviews)
          .where(and(eq(reviews.userId, userId), reviewsOf(input.target)))
      : [];

    const others = await ctx.db
      .select({
        id: reviews.id,
        author: users.name,
        body: reviews.body,
        // The author's rating of the same title or episode, in quarter points.
        rating: ratings.value,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .leftJoin(
        ratings,
        and(
          eq(ratings.userId, reviews.userId),
          eq(ratings.mediaId, reviews.mediaId),
          sql`${ratings.episodeId} is not distinct from ${reviews.episodeId}`,
        ),
      )
      .where(
        and(
          reviewsOf(input.target),
          eq(reviews.visibility, "public"),
          userId ? ne(reviews.userId, userId) : undefined,
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(MAX_REVIEWS_SHOWN);

    return { mine: mine ?? null, others };
  }),
});

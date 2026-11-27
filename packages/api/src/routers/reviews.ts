import { follows, profiles, ratings, reviews, visibilities } from "@yousiverse/db/schema";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { resolveTarget, type Target, target } from "../targets";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { visibleToOthers } from "../visibility";

const MAX_REVIEW_LENGTH = 10_000;
const MAX_REVIEWS_SHOWN = 50;

/** Reviews of a whole title leave out reviews of its episodes. */
function reviewsOf(target: Target) {
  return "episodeId" in target
    ? eq(reviews.episodeId, target.episodeId)
    : and(eq(reviews.mediaId, target.mediaId), isNull(reviews.episodeId));
}

/** Joins a review to its author's rating of the same title or episode. */
const authorsRating = and(
  eq(ratings.userId, reviews.userId),
  eq(ratings.mediaId, reviews.mediaId),
  sql`${ratings.episodeId} is not distinct from ${reviews.episodeId}`,
);

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
   * The reviews of a title or an episode that the asking person may read. `mine` is their own,
   * whoever else can see it. `others` are public reviews and friends-only ones by their
   * friends: people they follow first, and the newest first among those and among the rest. A
   * private review is never returned to anyone but its author. `count` is how many there are
   * to read, their own included, which can be more than `others` holds.
   */
  list: publicProcedure.input(z.object({ target })).query(async ({ ctx, input }) => {
    const viewerId = ctx.session?.user.id;

    const [mine] = viewerId
      ? await ctx.db
          .select({
            body: reviews.body,
            visibility: reviews.visibility,
            // Their own rating of the same title or episode, in quarter points.
            rating: ratings.value,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .leftJoin(ratings, authorsRating)
          .where(and(eq(reviews.userId, viewerId), reviewsOf(input.target)))
      : [];

    // A visitor follows nobody, and Postgres will not order by a constant.
    const followed = viewerId
      ? sql<boolean>`exists (select 1 from ${follows} where ${follows.followerId} = ${viewerId} and ${follows.followedId} = ${reviews.userId})`
      : undefined;
    const found = await ctx.db
      .select({
        id: reviews.id,
        // Null when the author has not chosen a username.
        author: profiles.username,
        body: reviews.body,
        // The author's rating of the same title or episode, in quarter points.
        rating: ratings.value,
        createdAt: reviews.createdAt,
        /** Whether the asking person follows the author. */
        following: followed ?? sql<boolean>`false`,
        // Counted before the limit, so it covers the reviews left out too.
        total: sql<number>`(count(*) over ())::int`,
      })
      .from(reviews)
      .leftJoin(profiles, eq(profiles.userId, reviews.userId))
      .leftJoin(ratings, authorsRating)
      .where(
        and(
          reviewsOf(input.target),
          visibleToOthers(viewerId, reviews.userId, reviews.visibility),
          viewerId ? ne(reviews.userId, viewerId) : undefined,
        ),
      )
      .orderBy(...(followed ? [desc(followed)] : []), desc(reviews.createdAt))
      .limit(MAX_REVIEWS_SHOWN);

    return {
      mine: mine ?? null,
      others: found.map(({ total: _total, ...review }) => review),
      count: (found[0]?.total ?? 0) + (mine ? 1 : 0),
    };
  }),
});

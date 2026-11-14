import {
  episodes,
  follows,
  libraryEntries,
  lists,
  media,
  profiles,
  ratings,
  reviews,
  seasons,
} from "@yousiverse/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";
import { visibleToOthers } from "../visibility";

/** How many of each kind of activity are read, and how many items the feed shows in all. */
const PER_KIND = 30;
const FEED_LENGTH = 40;

const titleFields = {
  type: media.type,
  title: media.title,
  providerId: media.providerId,
  posterUrl: media.posterUrl,
};

export const feedRouter = router({
  /**
   * What the people the signed-in person follows have lately added to their libraries,
   * reviewed, and made lists of, newest first. Only content the viewer may see is included.
   */
  following: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id;
    const followed = ctx.db
      .select({ id: follows.followedId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));

    const [followedCount, libraryChanges, newReviews, newLists] = await Promise.all([
      ctx.db.$count(follows, eq(follows.followerId, viewerId)),
      ctx.db
        .select({
          id: libraryEntries.id,
          at: libraryEntries.updatedAt,
          username: profiles.username,
          status: libraryEntries.status,
          // The person's rating of the title, in quarter points.
          rating: ratings.value,
          ...titleFields,
        })
        .from(libraryEntries)
        .innerJoin(profiles, eq(profiles.userId, libraryEntries.userId))
        .innerJoin(media, eq(media.id, libraryEntries.mediaId))
        .leftJoin(
          ratings,
          and(
            eq(ratings.userId, libraryEntries.userId),
            eq(ratings.mediaId, libraryEntries.mediaId),
            isNull(ratings.episodeId),
          ),
        )
        .where(
          and(
            inArray(libraryEntries.userId, followed),
            visibleToOthers(viewerId, libraryEntries.userId, libraryEntries.visibility),
          ),
        )
        .orderBy(desc(libraryEntries.updatedAt))
        .limit(PER_KIND),
      ctx.db
        .select({
          id: reviews.id,
          at: reviews.createdAt,
          username: profiles.username,
          body: reviews.body,
          rating: ratings.value,
          episodeName: episodes.name,
          episodeNumber: episodes.episodeNumber,
          seasonNumber: seasons.seasonNumber,
          ...titleFields,
        })
        .from(reviews)
        .innerJoin(profiles, eq(profiles.userId, reviews.userId))
        .innerJoin(media, eq(media.id, reviews.mediaId))
        .leftJoin(episodes, eq(episodes.id, reviews.episodeId))
        .leftJoin(seasons, eq(seasons.id, episodes.seasonId))
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
            inArray(reviews.userId, followed),
            visibleToOthers(viewerId, reviews.userId, reviews.visibility),
          ),
        )
        .orderBy(desc(reviews.createdAt))
        .limit(PER_KIND),
      ctx.db
        .select({
          id: lists.id,
          at: lists.createdAt,
          username: profiles.username,
          name: lists.name,
        })
        .from(lists)
        .innerJoin(profiles, eq(profiles.userId, lists.userId))
        .where(
          and(
            inArray(lists.userId, followed),
            visibleToOthers(viewerId, lists.userId, lists.visibility),
          ),
        )
        .orderBy(desc(lists.createdAt))
        .limit(PER_KIND),
    ]);

    const items = [
      // Every title with a page has a provider id; the checks narrow the type for callers.
      ...libraryChanges.flatMap(({ providerId, ...change }) =>
        providerId ? { kind: "library" as const, ...change, providerId } : [],
      ),
      ...newReviews.flatMap(
        ({ providerId, episodeName, episodeNumber, seasonNumber, ...review }) => {
          if (!providerId) return [];
          // Set only for a review of one episode.
          const episode =
            episodeName !== null && episodeNumber !== null && seasonNumber !== null
              ? { name: episodeName, episodeNumber, seasonNumber }
              : null;
          return { kind: "review" as const, ...review, providerId, episode };
        },
      ),
      ...newLists.map((list) => ({ kind: "list" as const, ...list })),
    ];
    items.sort((a, b) => b.at.getTime() - a.at.getTime());

    return { followedCount, items: items.slice(0, FEED_LENGTH) };
  }),
});

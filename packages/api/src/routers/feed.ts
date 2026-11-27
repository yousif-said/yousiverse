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
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, router } from "../trpc";
import { visibleToOthers } from "../visibility";
import { itemCount, withArtwork } from "./lists";

/** How many items one page of the feed shows. */
const FEED_LENGTH = 40;
// A page could be all one kind, and one more than a page shows whether anything older exists.
const PER_KIND = FEED_LENGTH + 1;
/** How many of a new list's titles are shown with it. */
const LIST_TITLES_SHOWN = 5;

export const feedRouter = router({
  /**
   * What the people the signed-in person follows have lately added to their libraries,
   * reviewed, and made lists of, newest first. Only content the viewer may see is included:
   * a list comes with its first titles because the viewer may open that list.
   * `before` asks for the page of activity older than that moment.
   */
  following: protectedProcedure
    .input(z.object({ before: z.iso.datetime().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id;
      const before = input?.before ? new Date(input.before) : undefined;
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
            ...titleSummary,
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
              before && lt(libraryEntries.updatedAt, before),
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
            ...titleSummary,
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
              before && lt(reviews.createdAt, before),
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
            itemCount,
          })
          .from(lists)
          .innerJoin(profiles, eq(profiles.userId, lists.userId))
          .where(
            and(
              inArray(lists.userId, followed),
              visibleToOthers(viewerId, lists.userId, lists.visibility),
              before && lt(lists.createdAt, before),
            ),
          )
          .orderBy(desc(lists.createdAt))
          .limit(PER_KIND),
      ]);

      const items = [
        ...withPages(libraryChanges).map((change) => ({ kind: "library" as const, ...change })),
        ...withPages(newReviews).map(({ episodeName, episodeNumber, seasonNumber, ...review }) => {
          // Set only for a review of one episode.
          const episode =
            episodeName !== null && episodeNumber !== null && seasonNumber !== null
              ? { name: episodeName, episodeNumber, seasonNumber }
              : null;
          return { kind: "review" as const, ...review, episode };
        }),
        ...(await withArtwork(ctx.db, newLists, LIST_TITLES_SHOWN)).map((list) => ({
          kind: "list" as const,
          ...list,
        })),
      ];
      items.sort((a, b) => b.at.getTime() - a.at.getTime());

      const page = items.slice(0, FEED_LENGTH);
      return {
        followedCount,
        items: page,
        /** Pass as `before` for the next page. Null when nothing older is left. */
        olderThan: items.length > FEED_LENGTH ? (page.at(-1)?.at.toISOString() ?? null) : null,
      };
    }),
});

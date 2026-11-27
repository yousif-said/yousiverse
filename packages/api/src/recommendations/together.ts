import type { Database } from "@yousiverse/db";
import { follows, libraryEntries, media, profiles, ratings } from "@yousiverse/db/schema";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { titleSummary, withPages } from "../titles";
import { visibleToOthers } from "../visibility";

/** Rating something highly starts at 8 out of 10, in quarter points. */
const RATED_HIGHLY = 32;
/** A favorite is worth suggesting even to someone who has not asked for it: 8.5 or higher. */
const FAVORITE_FROM = 34;
const MAX_PICKS = 8;
const MAX_COMPANIONS = 12;

/** Why two people would both enjoy a title, strongest reason first. Ratings are quarter points. */
export const togetherReasons = [
  "you_want_they_rated",
  "both_want",
  "you_rated_they_want",
  "they_rated",
] as const;
export type TogetherReason = (typeof togetherReasons)[number];

/**
 * The people someone follows who can be named: friends (who follow back, and so share more)
 * first, then the most recently followed.
 */
export async function companionsOf(db: Database, userId: string) {
  const back = alias(follows, "back");
  return db
    .select({ username: profiles.username })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, follows.followedId))
    .leftJoin(back, and(eq(back.followerId, follows.followedId), eq(back.followedId, userId)))
    .where(eq(follows.followerId, userId))
    .orderBy(sql`${back.id} is null`, desc(follows.createdAt), profiles.username)
    .limit(MAX_COMPANIONS);
}

/**
 * What the viewer and another person would both enjoy: titles the viewer wants that the other
 * rated highly or wants too, titles the viewer rated highly that the other wants, and the
 * other's favorites that the viewer has never touched. Everything known about the other person
 * comes from their library entries the viewer may see; a rating of theirs counts only where
 * its entry is visible.
 */
export async function titlesForTwo(db: Database, viewerId: string, otherId: string) {
  const mine = alias(libraryEntries, "mine");
  const myRating = alias(ratings, "my_rating");

  const shared = withPages(
    await db
      .select({
        ...titleSummary,
        theirStatus: libraryEntries.status,
        theirRating: ratings.value,
        myStatus: mine.status,
        myRating: myRating.value,
      })
      .from(libraryEntries)
      .innerJoin(media, eq(media.id, libraryEntries.mediaId))
      .leftJoin(
        ratings,
        and(
          eq(ratings.userId, libraryEntries.userId),
          eq(ratings.mediaId, libraryEntries.mediaId),
          isNull(ratings.episodeId),
        ),
      )
      .leftJoin(mine, and(eq(mine.userId, viewerId), eq(mine.mediaId, libraryEntries.mediaId)))
      .leftJoin(
        myRating,
        and(
          eq(myRating.userId, viewerId),
          eq(myRating.mediaId, libraryEntries.mediaId),
          isNull(myRating.episodeId),
        ),
      )
      .where(
        and(
          eq(libraryEntries.userId, otherId),
          visibleToOthers(viewerId, libraryEntries.userId, libraryEntries.visibility),
          or(eq(libraryEntries.status, "want"), gte(ratings.value, RATED_HIGHLY)),
        ),
      )
      .orderBy(media.title),
  );

  const picks = shared.flatMap(
    ({ theirStatus, theirRating, myStatus, myRating: own, ...title }) => {
      const theyRatedHighly = theirRating !== null && theirRating >= RATED_HIGHLY;
      const pick = (reason: TogetherReason, rating: number | null) => ({
        ...title,
        reason,
        rating,
      });

      if (myStatus === "want" && theyRatedHighly) return pick("you_want_they_rated", theirRating);
      if (myStatus === "want" && theirStatus === "want") return pick("both_want", null);
      if (own !== null && own >= RATED_HIGHLY && theirStatus === "want") {
        return pick("you_rated_they_want", own);
      }
      const untouched = myStatus === null && own === null;
      if (untouched && theirRating !== null && theirRating >= FAVORITE_FROM) {
        return pick("they_rated", theirRating);
      }
      return [];
    },
  );

  return picks
    .sort(
      (a, b) =>
        togetherReasons.indexOf(a.reason) - togetherReasons.indexOf(b.reason) ||
        (b.rating ?? 0) - (a.rating ?? 0),
    )
    .slice(0, MAX_PICKS);
}

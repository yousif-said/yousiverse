import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  episodes,
  follows,
  libraryEntries,
  libraryStatuses,
  listItems,
  lists,
  MAX_RATING,
  media,
  mediaTypes,
  profiles,
  ratings,
  reviews,
  seasons,
  users,
} from "@yousiverse/db/schema";
import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { type AnyPgColumn, alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { visibleFrom } from "../visibility";
import { withArtwork } from "./lists";

const MAX_REVIEWS_SHOWN = 50;
const MAX_PEOPLE_FOUND = 12;
const MAX_PEOPLE_ASKED = 200;
const HIGHEST_RATED_SHOWN = 10;
/** Ratings are grouped by half point for charts: 0, 0.5, 1 ... 10. */
const HALF_POINTS = MAX_RATING / 2 + 1;

/** Two people's taste is compared only once they have both rated this many of the same titles. */
export const MIN_SHARED_RATINGS = 3;
/**
 * How fast agreement falls as two people's ratings drift apart. Rating everything the same is
 * 100%; sitting one point out of ten apart on average is 74%; nearly four points apart is 0%.
 */
const MATCH_FALLOFF = 260;
/** Both people loved a title when each gave it at least 8.5. */
const LOVED_FROM = 34;
const BOTH_LOVED_SHOWN = 5;

/** 3 to 20 lowercase letters, digits, or underscores. Capitals are lowered, not rejected. */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

/** Finds whose profile a username names. Capitals in the address do not matter. */
export async function requireProfileOwner(db: Database, name: string): Promise<string> {
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, name.toLowerCase()));
  if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
  return profile.userId;
}

// Looser than `username`: any text is looked up, and text that is no username is simply not found.
export const profileOf = z.object({ username: z.string().max(100) });

type RatingColumns = Record<"userId" | "mediaId" | "episodeId", AnyPgColumn>;

/** Joins a person's rating of the whole title to their library entry for it. */
const ratingOfEntry = (rated: RatingColumns) =>
  and(
    eq(rated.userId, libraryEntries.userId),
    eq(rated.mediaId, libraryEntries.mediaId),
    isNull(rated.episodeId),
  );

export const profilesRouter = router({
  /** A person's public profile. */
  get: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const [profile] = await ctx.db
      .select({ username: profiles.username, name: users.name, joinedAt: users.createdAt })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(eq(profiles.userId, userId));
    if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

    const viewerId = ctx.session?.user.id;
    const isOwner = userId === viewerId;
    const follow = (followerId: string, followedId: string) =>
      ctx.db
        .select({ id: follows.id })
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followedId, followedId)));
    const [[followers], [following], [viewerFollows], [followsViewer]] = await Promise.all([
      ctx.db.select({ count: count() }).from(follows).where(eq(follows.followedId, userId)),
      ctx.db.select({ count: count() }).from(follows).where(eq(follows.followerId, userId)),
      viewerId && !isOwner ? follow(viewerId, userId) : [],
      viewerId && !isOwner ? follow(userId, viewerId) : [],
    ]);
    return {
      ...profile,
      isOwner,
      followerCount: followers?.count ?? 0,
      followingCount: following?.count ?? 0,
      /** Whether the signed-in person follows this one, and the other way round. */
      isFollowing: Boolean(viewerFollows),
      followsYou: Boolean(followsViewer),
    };
  }),

  /** People whose username or display name contains the text, for finding someone to follow. */
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(1).max(50) }))
    .query(({ ctx, input }) => {
      // The text is matched literally: % and _ would otherwise match anything.
      const pattern = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
      return ctx.db
        .select({ username: profiles.username, name: users.name })
        .from(profiles)
        .innerJoin(users, eq(users.id, profiles.userId))
        .where(or(ilike(profiles.username, pattern), ilike(users.name, pattern)))
        .orderBy(profiles.username)
        .limit(MAX_PEOPLE_FOUND);
    }),

  /**
   * The part of a person's library the viewer may see, the titles they rated highest first:
   * public entries, plus friends-only ones for a friend. Private entries are left out for
   * everyone, and the owner sees their own profile as the public does. Each entry carries the
   * person's own rating of the title, in quarter points.
   */
  library: publicProcedure
    .input(
      profileOf.extend({
        type: z.enum(mediaTypes).optional(),
        status: z.enum(libraryStatuses).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = await requireProfileOwner(ctx.db, input.username);
      const entries = await ctx.db
        .select({ ...titleSummary, status: libraryEntries.status, rating: ratings.value })
        .from(libraryEntries)
        .innerJoin(media, eq(media.id, libraryEntries.mediaId))
        .leftJoin(ratings, ratingOfEntry(ratings))
        .where(
          and(
            eq(libraryEntries.userId, userId),
            await visibleFrom(ctx.db, ctx.session?.user.id, userId, libraryEntries.visibility),
            input.type && eq(media.type, input.type),
            input.status && eq(libraryEntries.status, input.status),
          ),
        )
        .orderBy(
          sql`${ratings.value} desc nulls last`,
          desc(libraryEntries.updatedAt),
          media.title,
        );
      return withPages(entries);
    }),

  /**
   * A person's taste in numbers, from the part of their library the viewer may see: how many
   * titles of each medium and what they rate them on average, how their ratings spread over
   * the half points from 0 to 10, and the titles they rated highest. A rating counts only
   * where the library entry for its title is visible to the viewer. Averages are in quarter
   * points. Also how many reviews and lists of theirs the viewer may see.
   */
  stats: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const viewerId = ctx.session?.user.id;
    const [visibleEntry, visibleReview, visibleList] = await Promise.all([
      visibleFrom(ctx.db, viewerId, userId, libraryEntries.visibility),
      visibleFrom(ctx.db, viewerId, userId, reviews.visibility),
      visibleFrom(ctx.db, viewerId, userId, lists.visibility),
    ]);
    const theirEntries = and(eq(libraryEntries.userId, userId), visibleEntry);
    const halfPoint = sql<number>`floor(${ratings.value} / 2.0)::int`;

    const [byType, spread, highestRated, reviewCount, listCount] = await Promise.all([
      ctx.db
        .select({
          type: media.type,
          titles: count(),
          rated: count(ratings.id),
          points: sql<number>`coalesce(sum(${ratings.value}), 0)::int`,
        })
        .from(libraryEntries)
        .innerJoin(media, eq(media.id, libraryEntries.mediaId))
        .leftJoin(ratings, ratingOfEntry(ratings))
        .where(theirEntries)
        .groupBy(media.type),
      ctx.db
        .select({ halfPoint, count: count() })
        .from(libraryEntries)
        .innerJoin(ratings, ratingOfEntry(ratings))
        .where(theirEntries)
        .groupBy(halfPoint),
      ctx.db
        .select({ ...titleSummary, rating: ratings.value })
        .from(libraryEntries)
        .innerJoin(media, eq(media.id, libraryEntries.mediaId))
        .innerJoin(ratings, ratingOfEntry(ratings))
        .where(theirEntries)
        .orderBy(desc(ratings.value), desc(ratings.updatedAt), media.title)
        .limit(HIGHEST_RATED_SHOWN),
      ctx.db.$count(reviews, and(eq(reviews.userId, userId), visibleReview)),
      ctx.db.$count(lists, and(eq(lists.userId, userId), visibleList)),
    ]);

    const average = (points: number, rated: number) => (rated > 0 ? points / rated : null);
    const histogram = new Array<number>(HALF_POINTS).fill(0);
    for (const bar of spread) histogram[bar.halfPoint] = bar.count;
    const rated = byType.reduce((sum, row) => sum + row.rated, 0);
    const points = byType.reduce((sum, row) => sum + row.points, 0);
    return {
      /** One entry per medium, in the order the app lists them, even for a medium with nothing. */
      media: mediaTypes.map((type) => {
        const row = byType.find((candidate) => candidate.type === type);
        return {
          type,
          titles: row?.titles ?? 0,
          average: average(row?.points ?? 0, row?.rated ?? 0),
        };
      }),
      ratings: { count: rated, average: average(points, rated), histogram },
      highestRated: withPages(highestRated),
      counts: {
        titles: byType.reduce((sum, row) => sum + row.titles, 0),
        reviews: reviewCount,
        lists: listCount,
      },
    };
  }),

  /**
   * How closely the signed-in person's ratings agree with this person's, as a percentage, over
   * the titles both have rated. This person's rating of a title counts only where their library
   * entry for it is visible to the viewer. Null for a visitor, for one's own profile, and until
   * the two share `MIN_SHARED_RATINGS` rated titles, because fewer say nothing about taste.
   */
  match: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const viewerId = ctx.session?.user.id;
    if (!viewerId || viewerId === userId) return null;

    const theirs = alias(ratings, "theirs");
    const mine = alias(ratings, "mine");
    const shared = await ctx.db
      .select({ ...titleSummary, theirs: theirs.value, mine: mine.value })
      .from(libraryEntries)
      .innerJoin(media, eq(media.id, libraryEntries.mediaId))
      .innerJoin(theirs, ratingOfEntry(theirs))
      .innerJoin(
        mine,
        and(
          eq(mine.userId, viewerId),
          eq(mine.mediaId, libraryEntries.mediaId),
          isNull(mine.episodeId),
        ),
      )
      .where(
        and(
          eq(libraryEntries.userId, userId),
          await visibleFrom(ctx.db, viewerId, userId, libraryEntries.visibility),
        ),
      )
      .orderBy(sql`${theirs.value} + ${mine.value} desc`, media.title);
    if (shared.length < MIN_SHARED_RATINGS) return null;

    const apart =
      shared.reduce((sum, title) => sum + Math.abs(title.theirs - title.mine), 0) / shared.length;
    const bothLoved = shared
      .filter((title) => title.theirs >= LOVED_FROM && title.mine >= LOVED_FROM)
      .slice(0, BOTH_LOVED_SHOWN)
      .map(({ theirs: _theirs, mine: _mine, ...title }) => title);
    return {
      percent: Math.max(0, Math.round(100 - (apart / MAX_RATING) * MATCH_FALLOFF)),
      shared: shared.length,
      /** A few titles both people rated 8.5 or more, the ones they rated highest first. */
      bothLoved: withPages(bothLoved),
    };
  }),

  /**
   * Which of these people the signed-in person follows, and which of them follow back, for
   * drawing follow buttons beside a list of people. Both are empty for a visitor.
   */
  relations: publicProcedure
    .input(z.object({ usernames: z.array(z.string().max(100)).max(MAX_PEOPLE_ASKED) }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session?.user.id;
      const usernames = input.usernames.map((name) => name.toLowerCase());
      if (!viewerId || usernames.length === 0) return { following: [], followedBy: [] };

      const named = inArray(profiles.username, usernames);
      const [following, followedBy] = await Promise.all([
        ctx.db
          .select({ username: profiles.username })
          .from(follows)
          .innerJoin(profiles, eq(profiles.userId, follows.followedId))
          .where(and(eq(follows.followerId, viewerId), named)),
        ctx.db
          .select({ username: profiles.username })
          .from(follows)
          .innerJoin(profiles, eq(profiles.userId, follows.followerId))
          .where(and(eq(follows.followedId, viewerId), named)),
      ]);
      return {
        following: following.map((person) => person.username),
        followedBy: followedBy.map((person) => person.username),
      };
    }),

  /**
   * A person's lists that the viewer may see, most recently changed first, each with the first
   * few of its titles for its artwork: the same shape as the viewer's own lists.
   */
  lists: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const found = await ctx.db
      .select({
        id: lists.id,
        name: lists.name,
        description: lists.description,
        visibility: lists.visibility,
        itemCount: count(listItems.id),
      })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(
        and(
          eq(lists.userId, userId),
          await visibleFrom(ctx.db, ctx.session?.user.id, userId, lists.visibility),
        ),
      )
      .groupBy(lists.id)
      .orderBy(desc(lists.updatedAt), lists.name);
    return withArtwork(ctx.db, found);
  }),

  /** A person's reviews that the viewer may see, newest first, each with what it is about. */
  reviews: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const found = await ctx.db
      .select({
        ...titleSummary,
        id: reviews.id,
        body: reviews.body,
        createdAt: reviews.createdAt,
        // The person's rating of the same title or episode, in quarter points.
        rating: ratings.value,
        episodeName: episodes.name,
        episodeNumber: episodes.episodeNumber,
        seasonNumber: seasons.seasonNumber,
      })
      .from(reviews)
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
          eq(reviews.userId, userId),
          await visibleFrom(ctx.db, ctx.session?.user.id, userId, reviews.visibility),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(MAX_REVIEWS_SHOWN);
    return found.flatMap(({ providerId, episodeName, episodeNumber, seasonNumber, ...review }) => {
      if (!providerId) return [];
      // Set only for a review of one episode.
      const episode =
        episodeName !== null && episodeNumber !== null && seasonNumber !== null
          ? { name: episodeName, episodeNumber, seasonNumber }
          : null;
      return { ...review, providerId, episode };
    });
  }),

  /** The signed-in person's own name and username. The username is null until they choose one. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const [me] = await ctx.db
      .select({ name: users.name, username: profiles.username })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, ctx.session.user.id));
    if (!me) throw new TRPCError({ code: "NOT_FOUND" });
    return me;
  }),

  /** Sets the display name and chooses or changes the username. Answers CONFLICT if it is taken. */
  save: protectedProcedure
    .input(z.object({ username, name: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [taken] = await ctx.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(and(eq(profiles.username, input.username), ne(profiles.userId, userId)));
      if (taken) throw new TRPCError({ code: "CONFLICT", message: "That username is taken." });

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(profiles)
          .values({ userId, username: input.username })
          .onConflictDoUpdate({ target: profiles.userId, set: { username: input.username } });
        await tx.update(users).set({ name: input.name }).where(eq(users.id, userId));
      });
      return input;
    }),
});

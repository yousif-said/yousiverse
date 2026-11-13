import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  episodes,
  libraryEntries,
  libraryStatuses,
  listItems,
  lists,
  media,
  mediaTypes,
  profiles,
  ratings,
  reviews,
  seasons,
  users,
} from "@yousiverse/db/schema";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const MAX_REVIEWS_SHOWN = 50;

/** 3 to 20 lowercase letters, digits, or underscores. Capitals are lowered, not rejected. */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

/** Finds whose profile a username names. Capitals in the address do not matter. */
async function requireProfileOwner(db: Database, name: string): Promise<string> {
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.username, name.toLowerCase()));
  if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
  return profile.userId;
}

// Looser than `username`: any text is looked up, and text that is no username is simply not found.
const profileOf = z.object({ username: z.string().max(100) });

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
    return { ...profile, isOwner: userId === ctx.session?.user.id };
  }),

  /**
   * The public part of a person's library, most recently changed first. Private entries are
   * left out for everyone, the owner included: a profile shows what other people see.
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
        .select({
          status: libraryEntries.status,
          mediaId: media.id,
          type: media.type,
          title: media.title,
          releaseYear: media.releaseYear,
          posterUrl: media.posterUrl,
          providerId: media.providerId,
        })
        .from(libraryEntries)
        .innerJoin(media, eq(media.id, libraryEntries.mediaId))
        .where(
          and(
            eq(libraryEntries.userId, userId),
            eq(libraryEntries.visibility, "public"),
            input.type && eq(media.type, input.type),
            input.status && eq(libraryEntries.status, input.status),
          ),
        )
        .orderBy(desc(libraryEntries.updatedAt), media.title);
      // Every title with a page has a provider id; this narrows the type for callers.
      return entries.flatMap((entry) =>
        entry.providerId ? { ...entry, providerId: entry.providerId } : [],
      );
    }),

  /** A person's public lists, most recently changed first. */
  lists: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    return ctx.db
      .select({ id: lists.id, name: lists.name, itemCount: count(listItems.id) })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(and(eq(lists.userId, userId), eq(lists.visibility, "public")))
      .groupBy(lists.id)
      .orderBy(desc(lists.updatedAt), lists.name);
  }),

  /** A person's public reviews, newest first, each with the title or episode it is about. */
  reviews: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    const found = await ctx.db
      .select({
        id: reviews.id,
        body: reviews.body,
        createdAt: reviews.createdAt,
        // The person's rating of the same title or episode, in quarter points.
        rating: ratings.value,
        type: media.type,
        title: media.title,
        providerId: media.providerId,
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
      .where(and(eq(reviews.userId, userId), eq(reviews.visibility, "public")))
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

import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { follows, profiles, users } from "@yousiverse/db/schema";
import { and, count, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { profileOf, requireProfileOwner } from "./profiles";

const MAX_PEOPLE_SHOWN = 200;
const MAX_SUGGESTIONS = 6;

/**
 * The people on one side of a person's follows, most recent first. Only people with a username
 * are named; `unnamed` counts the rest.
 */
async function people(db: Database, userId: string, side: "followers" | "following") {
  const [theirs, other] =
    side === "followers"
      ? [follows.followedId, follows.followerId]
      : [follows.followerId, follows.followedId];
  const found = await db
    .select({ username: profiles.username, name: users.name })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .leftJoin(profiles, eq(profiles.userId, other))
    .where(eq(theirs, userId))
    .orderBy(desc(follows.createdAt))
    .limit(MAX_PEOPLE_SHOWN);

  const named = found.flatMap((person) =>
    person.username ? { username: person.username, name: person.name } : [],
  );
  return { people: named, unnamed: found.length - named.length };
}

export const followsRouter = router({
  /** Starts following the person with this username. Following twice changes nothing. */
  follow: protectedProcedure.input(profileOf).mutation(async ({ ctx, input }) => {
    const followedId = await requireProfileOwner(ctx.db, input.username);
    const followerId = ctx.session.user.id;
    if (followedId === followerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot follow yourself." });
    }
    await ctx.db.insert(follows).values({ followerId, followedId }).onConflictDoNothing();
  }),

  unfollow: protectedProcedure.input(profileOf).mutation(async ({ ctx, input }) => {
    const followedId = await requireProfileOwner(ctx.db, input.username);
    await ctx.db
      .delete(follows)
      .where(and(eq(follows.followerId, ctx.session.user.id), eq(follows.followedId, followedId)));
  }),

  /** Who follows a person. */
  followers: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    return people(ctx.db, userId, "followers");
  }),

  /** Who a person follows. */
  following: publicProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const userId = await requireProfileOwner(ctx.db, input.username);
    return people(ctx.db, userId, "following");
  }),

  /**
   * The people the signed-in person follows, most recent first, each saying whether they follow
   * back (which makes the two friends).
   */
  mine: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(MAX_PEOPLE_SHOWN) }).optional())
    .query(({ ctx, input }) => {
      const viewerId = ctx.session.user.id;
      const back = alias(follows, "back");
      return ctx.db
        .select({
          username: profiles.username,
          name: users.name,
          followsYou: sql<boolean>`${back.id} is not null`,
        })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followedId))
        .innerJoin(profiles, eq(profiles.userId, follows.followedId))
        .leftJoin(back, and(eq(back.followerId, follows.followedId), eq(back.followedId, viewerId)))
        .where(eq(follows.followerId, viewerId))
        .orderBy(desc(follows.createdAt))
        .limit(input?.limit ?? MAX_PEOPLE_SHOWN);
    }),

  /**
   * People the signed-in person might follow and does not yet: first those who follow them,
   * then those followed by the people they follow, the most followed among them first. Who
   * follows whom is public, so this tells the viewer nothing a profile would not.
   */
  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id;
    const followed = ctx.db
      .select({ id: follows.followedId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    const person = { username: profiles.username, name: users.name };

    const [followers, followedByFollowed] = await Promise.all([
      ctx.db
        .select(person)
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followerId))
        .innerJoin(profiles, eq(profiles.userId, follows.followerId))
        .where(and(eq(follows.followedId, viewerId), notInArray(follows.followerId, followed)))
        .orderBy(desc(follows.createdAt))
        .limit(MAX_SUGGESTIONS),
      ctx.db
        .select(person)
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followedId))
        .innerJoin(profiles, eq(profiles.userId, follows.followedId))
        .where(
          and(
            inArray(follows.followerId, followed),
            ne(follows.followedId, viewerId),
            notInArray(follows.followedId, followed),
          ),
        )
        .groupBy(profiles.username, users.name)
        .orderBy(desc(count()), profiles.username)
        // Some of these may also follow the viewer, and are then listed once, as followers.
        .limit(MAX_SUGGESTIONS * 2),
    ]);

    const alreadyListed = new Set(followers.map((follower) => follower.username));
    return [
      ...followers.map((follower) => ({ ...follower, followsYou: true })),
      ...followedByFollowed
        .filter((other) => !alreadyListed.has(other.username))
        .map((other) => ({ ...other, followsYou: false })),
    ].slice(0, MAX_SUGGESTIONS);
  }),
});

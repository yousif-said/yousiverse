import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { follows, profiles, users } from "@yousiverse/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { profileOf, requireProfileOwner } from "./profiles";

const MAX_PEOPLE_SHOWN = 200;

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
});

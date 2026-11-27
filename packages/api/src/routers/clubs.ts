import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  clubAccessLevels,
  clubMembers,
  clubPicks,
  clubs,
  clubThreads,
  follows,
  media,
  mediaTypes,
  profiles,
  ratings,
  users,
} from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const MAX_CLUBS_LISTED = 50;
/** How many picks, and how many members, a club's tile shows. */
const TILE_PICKS = 4;
const TILE_MEMBERS = 4;

const clubId = z.uuid();
const mediaId = z.uuid();
const details = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  access: z.enum(clubAccessLevels),
  // Listed in the order of `mediaTypes`, once each, however they were sent.
  mediaTypes: z
    .array(z.enum(mediaTypes))
    .min(1)
    .transform((chosen) => mediaTypes.filter((type) => chosen.includes(type))),
};

/** A long random string for an invite link, impossible to guess. */
const newInviteCode = () => randomBytes(18).toString("base64url");

type Club = typeof clubs.$inferSelect;

async function findClub(db: Database, id: string): Promise<Club> {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
  if (!club) throw new TRPCError({ code: "NOT_FOUND" });
  return club;
}

export async function isMember(db: Database, id: string, userId: string | undefined) {
  if (!userId) return false;
  const [member] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, id), eq(clubMembers.userId, userId)));
  return Boolean(member);
}

/**
 * The club, for someone allowed inside it: anyone for a public club, members only for an
 * invite-only one. Everyone else is told there is no such club.
 */
export async function requireVisibleClub(db: Database, id: string, userId: string | undefined) {
  const club = await findClub(db, id);
  const member = await isMember(db, id, userId);
  if (club.access === "invite_only" && !member) throw new TRPCError({ code: "NOT_FOUND" });
  return { club, member };
}

/** The club, for a member. A non-member of a club they may see is refused rather than not found. */
export async function requireMembership(db: Database, id: string, userId: string) {
  const { club, member } = await requireVisibleClub(db, id, userId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Join the club to do that." });
  }
  return club;
}

/** Stops anyone but a club's owner from changing it, without revealing that it exists. */
async function requireOwnClub(db: Database, id: string, userId: string): Promise<Club> {
  const club = await findClub(db, id);
  if (club.ownerId !== userId) throw new TRPCError({ code: "NOT_FOUND" });
  return club;
}

/** Club members are shown by username, so a person needs one before making or joining a club. */
async function requireUsername(db: Database, userId: string) {
  const [profile] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!profile) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Choose a username on your account page first. Clubs show members by username.",
    });
  }
}

// Written out with table names: in a query on `clubs` alone, column references are generated
// without them, and a bare "id" inside the subquery would mean the membership's id.
const memberCount = sql<number>`(select count(*)::int from "club_members" where "club_members"."club_id" = "clubs"."id")`;

// Written out with table names for the same reason, in a query that starts from `club_threads`.
export const replyCount = sql<number>`(select count(*)::int from "club_replies" where "club_replies"."thread_id" = "club_threads"."id")`;

const summaryFields = {
  id: clubs.id,
  name: clubs.name,
  description: clubs.description,
  access: clubs.access,
  mediaTypes: clubs.mediaTypes,
  memberCount,
  // The person who runs the club.
  owner: profiles.username,
};

/** The follow in the other direction, for asking both ways about two people in one query. */
const followsBack = alias(follows, "follows_back");

/** Only titles of the media types a club covers now count as its picks. */
const coveredByClub = sql`${media.type} = any(${clubs.mediaTypes})`;

/**
 * Adds what a club's tile shows: its latest picks' artwork, its first members, and its most
 * recently active discussion. Only for clubs the viewer may look inside: their own, or public.
 */
async function withTileDetails<Summary extends { id: string }>(db: Database, found: Summary[]) {
  if (found.length === 0) return [];
  const ids = found.map((club) => club.id);
  const latestPicks = db
    .select({
      clubId: clubPicks.clubId,
      ...titleSummary,
      position:
        sql<number>`row_number() over (partition by ${clubPicks.clubId} order by ${clubPicks.createdAt} desc, ${media.title})`.as(
          "position",
        ),
    })
    .from(clubPicks)
    .innerJoin(clubs, eq(clubs.id, clubPicks.clubId))
    .innerJoin(media, eq(media.id, clubPicks.mediaId))
    .where(and(inArray(clubPicks.clubId, ids), coveredByClub, isNotNull(media.providerId)))
    .as("latest_picks");
  const firstMembers = db
    .select({
      clubId: clubMembers.clubId,
      username: profiles.username,
      position:
        sql<number>`row_number() over (partition by ${clubMembers.clubId} order by ${clubMembers.createdAt})`.as(
          "position",
        ),
    })
    .from(clubMembers)
    .innerJoin(profiles, eq(profiles.userId, clubMembers.userId))
    .where(inArray(clubMembers.clubId, ids))
    .as("first_members");

  const [picks, members, discussions] = await Promise.all([
    db
      .select()
      .from(latestPicks)
      .where(lte(latestPicks.position, TILE_PICKS))
      .orderBy(latestPicks.clubId, latestPicks.position),
    db
      .select()
      .from(firstMembers)
      .where(lte(firstMembers.position, TILE_MEMBERS))
      .orderBy(firstMembers.clubId, firstMembers.position),
    db
      .selectDistinctOn([clubThreads.clubId], {
        clubId: clubThreads.clubId,
        id: clubThreads.id,
        title: clubThreads.title,
        replyCount,
      })
      .from(clubThreads)
      .where(inArray(clubThreads.clubId, ids))
      .orderBy(clubThreads.clubId, desc(clubThreads.activeAt), desc(clubThreads.id)),
  ]);

  return found.map((club) => {
    const newestPicks = withPages(picks)
      .filter((pick) => pick.clubId === club.id)
      .map(({ clubId: _clubId, position: _position, ...title }) => title);
    const latest = discussions.find((discussion) => discussion.clubId === club.id);
    return {
      ...club,
      /** The color of the newest pick's artwork, for marking the club where it is only named. */
      hue: newestPicks[0]?.artHue ?? null,
      picks: newestPicks,
      /** Usernames of the first members, the owner first. */
      members: members
        .filter((member) => member.clubId === club.id)
        .map((member) => member.username),
      latestDiscussion: latest
        ? { id: latest.id, title: latest.title, replyCount: latest.replyCount }
        : null,
    };
  });
}

export const clubsRouter = router({
  /** Starts a club. Its maker becomes the owner and its first member. */
  create: protectedProcedure.input(z.object(details)).mutation(async ({ ctx, input }) => {
    const ownerId = ctx.session.user.id;
    await requireUsername(ctx.db, ownerId);
    return ctx.db.transaction(async (tx) => {
      const [club] = await tx
        .insert(clubs)
        .values({
          ...input,
          description: input.description || null,
          ownerId,
          inviteCode: newInviteCode(),
        })
        .returning({ id: clubs.id });
      if (!club) throw new Error("Creating a club returned no row.");
      await tx.insert(clubMembers).values({ clubId: club.id, userId: ownerId });
      return club;
    });
  }),

  /** The clubs the signed-in person belongs to, by name, each with what its tile shows. */
  mine: protectedProcedure.query(async ({ ctx }) =>
    withTileDetails(
      ctx.db,
      await ctx.db
        .select(summaryFields)
        .from(clubs)
        .innerJoin(clubMembers, eq(clubMembers.clubId, clubs.id))
        .leftJoin(profiles, eq(profiles.userId, clubs.ownerId))
        .where(eq(clubMembers.userId, ctx.session.user.id))
        .orderBy(asc(clubs.name)),
    ),
  ),

  /**
   * Public clubs anyone can join, largest first and newest first among clubs of a size, each
   * with what its tile shows. Invite-only clubs are never listed.
   */
  discover: publicProcedure.query(async ({ ctx }) =>
    withTileDetails(
      ctx.db,
      await ctx.db
        .select(summaryFields)
        .from(clubs)
        .leftJoin(profiles, eq(profiles.userId, clubs.ownerId))
        .where(eq(clubs.access, "public"))
        .orderBy(desc(memberCount), desc(clubs.createdAt))
        .limit(MAX_CLUBS_LISTED),
    ),
  ),

  /**
   * A club and its members. An invite-only club exists only for its members, except that
   * someone holding its invite code is shown enough to decide whether to join.
   */
  get: publicProcedure
    .input(z.object({ id: clubId, invite: z.string().max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      const club = await findClub(ctx.db, input.id);
      const member = await isMember(ctx.db, club.id, userId);
      const invited = input.invite !== undefined && input.invite === club.inviteCode;
      if (club.access === "invite_only" && !member && !invited) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const inside = member || club.access === "public";
      const [[owner], [members], people] = await Promise.all([
        ctx.db
          .select({ username: profiles.username })
          .from(profiles)
          .where(eq(profiles.userId, club.ownerId)),
        ctx.db.select({ count: count() }).from(clubMembers).where(eq(clubMembers.clubId, club.id)),
        // Someone only holding an invite sees how many members there are, not who they are.
        inside
          ? ctx.db
              .select({
                userId: clubMembers.userId,
                username: profiles.username,
                name: users.name,
                /** Whether the viewer follows this member, and the other way round. */
                isFollowing: sql<boolean>`${follows.id} is not null`,
                followsYou: sql<boolean>`${followsBack.id} is not null`,
              })
              .from(clubMembers)
              .innerJoin(users, eq(users.id, clubMembers.userId))
              .innerJoin(profiles, eq(profiles.userId, clubMembers.userId))
              .leftJoin(
                follows,
                and(
                  eq(follows.followerId, userId ?? ""),
                  eq(follows.followedId, clubMembers.userId),
                ),
              )
              .leftJoin(
                followsBack,
                and(
                  eq(followsBack.followerId, clubMembers.userId),
                  eq(followsBack.followedId, userId ?? ""),
                ),
              )
              .where(eq(clubMembers.clubId, club.id))
              .orderBy(asc(clubMembers.createdAt))
          : [],
      ]);
      const isOwner = club.ownerId === userId;
      return {
        id: club.id,
        name: club.name,
        description: club.description,
        access: club.access,
        mediaTypes: club.mediaTypes,
        owner: owner?.username ?? null,
        memberCount: members?.count ?? 0,
        members: people.map(({ userId: memberId, ...person }) => ({
          ...person,
          isViewer: memberId === userId,
        })),
        isMember: member,
        isOwner,
        /** Whether the viewer could join right now, given the invite code they sent. */
        canJoin: !member && (club.access === "public" || invited),
        // Only the owner is given the code to hand out.
        inviteCode: isOwner ? club.inviteCode : null,
      };
    }),

  /** Joins a club. An invite-only club needs its invite code. */
  join: protectedProcedure
    .input(z.object({ id: clubId, invite: z.string().max(100).optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const club = await findClub(ctx.db, input.id);
      if (club.access === "invite_only" && input.invite !== club.inviteCode) {
        // The same answer as for a club that does not exist.
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await requireUsername(ctx.db, userId);
      await ctx.db.insert(clubMembers).values({ clubId: club.id, userId }).onConflictDoNothing();
    }),

  /** Leaves a club. Its owner cannot leave; they delete the club instead. */
  leave: protectedProcedure.input(z.object({ id: clubId })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const club = await findClub(ctx.db, input.id);
    if (club.ownerId === userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You run this club, so you cannot leave it. Delete it instead.",
      });
    }
    await ctx.db
      .delete(clubMembers)
      .where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, userId)));
  }),

  update: protectedProcedure
    .input(z.object({ id: clubId, ...details }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      await requireOwnClub(ctx.db, id, ctx.session.user.id);
      await ctx.db
        .update(clubs)
        .set({ ...changes, description: changes.description || null })
        .where(eq(clubs.id, id));
    }),

  /** Replaces the invite code, so the old invite link stops working. */
  resetInvite: protectedProcedure
    .input(z.object({ id: clubId }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnClub(ctx.db, input.id, ctx.session.user.id);
      const inviteCode = newInviteCode();
      await ctx.db.update(clubs).set({ inviteCode }).where(eq(clubs.id, input.id));
      return { inviteCode };
    }),

  /** Takes a member out of a club. Only its owner can, and not themselves. */
  removeMember: protectedProcedure
    .input(z.object({ id: clubId, username: z.string().max(100) }))
    .mutation(async ({ ctx, input }) => {
      const club = await requireOwnClub(ctx.db, input.id, ctx.session.user.id);
      const [member] = await ctx.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(eq(profiles.username, input.username.toLowerCase()));
      if (!member || member.userId === club.ownerId) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db
        .delete(clubMembers)
        .where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, member.userId)));
    }),

  remove: protectedProcedure.input(z.object({ id: clubId })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(clubs)
      .where(and(eq(clubs.id, input.id), eq(clubs.ownerId, ctx.session.user.id)));
  }),

  /**
   * The titles a club has picked, newest first, each with the average of its members' ratings.
   * Only titles of the media types the club covers are returned, even if it covered more once.
   */
  picks: publicProcedure.input(z.object({ id: clubId })).query(async ({ ctx, input }) => {
    const userId = ctx.session?.user.id;
    const { club } = await requireVisibleClub(ctx.db, input.id, userId);

    const [picked, memberRatings] = await Promise.all([
      ctx.db
        .select({
          ...titleSummary,
          addedById: clubPicks.addedBy,
          // Null when the member who picked it has since deleted their account.
          addedBy: profiles.username,
        })
        .from(clubPicks)
        .innerJoin(media, eq(media.id, clubPicks.mediaId))
        .leftJoin(profiles, eq(profiles.userId, clubPicks.addedBy))
        .where(and(eq(clubPicks.clubId, club.id), inArray(media.type, club.mediaTypes)))
        .orderBy(desc(clubPicks.createdAt), asc(media.title)),
      // Ratings of whole titles, by people who are members now.
      ctx.db
        .select({
          mediaId: clubPicks.mediaId,
          average: sql<number>`avg(${ratings.value})::float`,
          count: count(ratings.id),
        })
        .from(clubPicks)
        .innerJoin(clubMembers, eq(clubMembers.clubId, clubPicks.clubId))
        .innerJoin(
          ratings,
          and(
            eq(ratings.userId, clubMembers.userId),
            eq(ratings.mediaId, clubPicks.mediaId),
            isNull(ratings.episodeId),
          ),
        )
        .where(eq(clubPicks.clubId, club.id))
        .groupBy(clubPicks.mediaId),
    ]);

    const ratingOf = new Map(memberRatings.map((rating) => [rating.mediaId, rating]));
    return withPages(picked).map(({ addedById, ...pick }) => {
      const rating = ratingOf.get(pick.mediaId);
      return {
        ...pick,
        /** The members' average rating in quarter points, and how many of them rated it. */
        clubRating: rating ? { average: rating.average, count: rating.count } : null,
        // The owner can remove any pick; a member can remove their own.
        canRemove: userId !== undefined && (club.ownerId === userId || addedById === userId),
      };
    });
  }),

  /** The signed-in person's clubs that cover a title's media type, saying which picked it. */
  forTitle: protectedProcedure.input(z.object({ mediaId })).query(async ({ ctx, input }) => {
    const [title] = await ctx.db
      .select({ type: media.type })
      .from(media)
      .where(eq(media.id, input.mediaId));
    if (!title) throw new TRPCError({ code: "NOT_FOUND" });

    return ctx.db
      .select({
        id: clubs.id,
        name: clubs.name,
        picked: sql<boolean>`${clubPicks.id} is not null`,
      })
      .from(clubs)
      .innerJoin(clubMembers, eq(clubMembers.clubId, clubs.id))
      .leftJoin(
        clubPicks,
        and(eq(clubPicks.clubId, clubs.id), eq(clubPicks.mediaId, input.mediaId)),
      )
      .where(
        and(
          eq(clubMembers.userId, ctx.session.user.id),
          sql`${title.type} = any(${clubs.mediaTypes})`,
        ),
      )
      .orderBy(asc(clubs.name));
  }),

  /** Picks a title for a club. Any member can, for titles of a type the club covers. */
  addPick: protectedProcedure
    .input(z.object({ id: clubId, mediaId }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const club = await requireMembership(ctx.db, input.id, userId);
      const [title] = await ctx.db
        .select({ type: media.type })
        .from(media)
        .where(eq(media.id, input.mediaId));
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });
      if (!club.mediaTypes.includes(title.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This club does not cover that kind of title.",
        });
      }
      await ctx.db
        .insert(clubPicks)
        .values({ clubId: club.id, mediaId: input.mediaId, addedBy: userId })
        .onConflictDoNothing();
    }),

  /** Takes a pick back. The club's owner can remove any pick; a member only their own. */
  removePick: protectedProcedure
    .input(z.object({ id: clubId, mediaId }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const club = await requireMembership(ctx.db, input.id, userId);
      const [pick] = await ctx.db
        .select({ id: clubPicks.id, addedBy: clubPicks.addedBy })
        .from(clubPicks)
        .where(and(eq(clubPicks.clubId, club.id), eq(clubPicks.mediaId, input.mediaId)));
      if (!pick) return;
      if (club.ownerId !== userId && pick.addedBy !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the member who picked it, or the club's owner, can remove a pick.",
        });
      }
      await ctx.db.delete(clubPicks).where(eq(clubPicks.id, pick.id));
    }),
});

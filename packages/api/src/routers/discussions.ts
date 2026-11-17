import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { clubReplies, clubThreads, profiles } from "@yousiverse/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { requireMembership, requireVisibleClub } from "./clubs";

const MAX_THREADS_LISTED = 50;
const MAX_REPLIES_SHOWN = 500;

const threadId = z.uuid();
const body = z.string().trim().min(1).max(5000);

async function findThread(db: Database, id: string) {
  const [thread] = await db.select().from(clubThreads).where(eq(clubThreads.id, id));
  if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
  return thread;
}

const ONLY_AUTHOR_OR_OWNER = "Only the member who wrote it, or the club's owner, can delete it.";

// Written out with table names: in a query that starts from `club_threads`, a bare "id" inside
// the subquery would mean the reply's own id.
const replyCount = sql<number>`(select count(*)::int from "club_replies" where "club_replies"."thread_id" = "club_threads"."id")`;

export const discussionsRouter = router({
  /**
   * A club's discussions, the most recently active first. Anyone can read a public club's;
   * an invite-only club's are for its members.
   */
  list: publicProcedure.input(z.object({ clubId: z.uuid() })).query(async ({ ctx, input }) => {
    await requireVisibleClub(ctx.db, input.clubId, ctx.session?.user.id);
    return ctx.db
      .select({
        id: clubThreads.id,
        title: clubThreads.title,
        author: profiles.username,
        activeAt: clubThreads.activeAt,
        replyCount,
      })
      .from(clubThreads)
      .leftJoin(profiles, eq(profiles.userId, clubThreads.authorId))
      .where(eq(clubThreads.clubId, input.clubId))
      .orderBy(desc(clubThreads.activeAt), desc(clubThreads.id))
      .limit(MAX_THREADS_LISTED);
  }),

  /** One discussion with its replies, oldest first. */
  get: publicProcedure.input(z.object({ id: threadId })).query(async ({ ctx, input }) => {
    const viewerId = ctx.session?.user.id;
    const thread = await findThread(ctx.db, input.id);
    const { club, member } = await requireVisibleClub(ctx.db, thread.clubId, viewerId);
    const mayRemove = (authorId: string | null) =>
      member && viewerId !== undefined && (viewerId === authorId || viewerId === club.ownerId);

    const [[author], replies] = await Promise.all([
      ctx.db
        .select({ username: profiles.username })
        .from(profiles)
        .where(eq(profiles.userId, thread.authorId ?? "")),
      ctx.db
        .select({
          id: clubReplies.id,
          body: clubReplies.body,
          authorId: clubReplies.authorId,
          author: profiles.username,
          createdAt: clubReplies.createdAt,
        })
        .from(clubReplies)
        .leftJoin(profiles, eq(profiles.userId, clubReplies.authorId))
        .where(eq(clubReplies.threadId, thread.id))
        .orderBy(asc(clubReplies.createdAt), asc(clubReplies.id))
        .limit(MAX_REPLIES_SHOWN),
    ]);
    return {
      id: thread.id,
      club: { id: club.id, name: club.name },
      title: thread.title,
      body: thread.body,
      author: author?.username ?? null,
      createdAt: thread.createdAt,
      canRemove: mayRemove(thread.authorId),
      /** Whether the viewer is a member, and so may reply. */
      isMember: member,
      replies: replies.map(({ authorId, ...reply }) => ({
        ...reply,
        canRemove: mayRemove(authorId),
      })),
    };
  }),

  /** Starts a discussion in a club the signed-in person belongs to. */
  start: protectedProcedure
    .input(z.object({ clubId: z.uuid(), title: z.string().trim().min(1).max(120), body }))
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.session.user.id;
      await requireMembership(ctx.db, input.clubId, authorId);
      const [thread] = await ctx.db
        .insert(clubThreads)
        .values({ ...input, authorId })
        .returning({ id: clubThreads.id });
      if (!thread) throw new Error("Starting a discussion returned no row.");
      return thread;
    }),

  /** Replies to a discussion, which moves it to the top of its club's list. */
  reply: protectedProcedure.input(z.object({ threadId, body })).mutation(async ({ ctx, input }) => {
    const authorId = ctx.session.user.id;
    const thread = await findThread(ctx.db, input.threadId);
    await requireMembership(ctx.db, thread.clubId, authorId);
    return ctx.db.transaction(async (tx) => {
      const [reply] = await tx
        .insert(clubReplies)
        .values({ threadId: thread.id, authorId, body: input.body })
        .returning({ id: clubReplies.id, createdAt: clubReplies.createdAt });
      if (!reply) throw new Error("Replying returned no row.");
      await tx
        .update(clubThreads)
        .set({ activeAt: reply.createdAt })
        .where(eq(clubThreads.id, thread.id));
      return { id: reply.id };
    });
  }),

  /** Deletes a discussion and its replies. For its author or the club's owner. */
  remove: protectedProcedure.input(z.object({ id: threadId })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const thread = await findThread(ctx.db, input.id);
    const club = await requireMembership(ctx.db, thread.clubId, userId);
    if (club.ownerId !== userId && thread.authorId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: ONLY_AUTHOR_OR_OWNER });
    }
    await ctx.db.delete(clubThreads).where(eq(clubThreads.id, thread.id));
    return { clubId: club.id };
  }),

  /** Deletes one reply. For its author or the club's owner. */
  removeReply: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [reply] = await ctx.db.select().from(clubReplies).where(eq(clubReplies.id, input.id));
      if (!reply) throw new TRPCError({ code: "NOT_FOUND" });
      const thread = await findThread(ctx.db, reply.threadId);
      const club = await requireMembership(ctx.db, thread.clubId, userId);
      if (club.ownerId !== userId && reply.authorId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: ONLY_AUTHOR_OR_OWNER });
      }
      await ctx.db.delete(clubReplies).where(eq(clubReplies.id, reply.id));
    }),
});

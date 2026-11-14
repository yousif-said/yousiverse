import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { listItems, lists, media, profiles, visibilities } from "@yousiverse/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { areFriends } from "../visibility";

const listId = z.uuid();
const mediaId = z.uuid();
const details = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(visibilities).optional(),
};

/** Stops anyone but a list's owner from changing it, without revealing that it exists. */
async function requireOwnList(db: Database, userId: string, id: string): Promise<void> {
  const [list] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
  if (!list) throw new TRPCError({ code: "NOT_FOUND" });
}

export const listsRouter = router({
  /** The signed-in person's lists, most recently changed first. */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: lists.id,
        name: lists.name,
        visibility: lists.visibility,
        itemCount: count(listItems.id),
      })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(eq(lists.userId, ctx.session.user.id))
      .groupBy(lists.id)
      .orderBy(desc(lists.updatedAt), lists.name),
  ),

  /** The signed-in person's lists, each saying whether it holds the given title. */
  forTitle: protectedProcedure.input(z.object({ mediaId })).query(({ ctx, input }) =>
    ctx.db
      .select({
        id: lists.id,
        name: lists.name,
        contains: sql<boolean>`${listItems.id} is not null`,
      })
      .from(lists)
      .leftJoin(
        listItems,
        and(eq(listItems.listId, lists.id), eq(listItems.mediaId, input.mediaId)),
      )
      .where(eq(lists.userId, ctx.session.user.id))
      .orderBy(lists.name),
  ),

  /**
   * A list and its titles. A private list exists only for its owner, and a friends-only list
   * only for its owner and their friends.
   */
  get: publicProcedure.input(z.object({ id: listId })).query(async ({ ctx, input }) => {
    const [list] = await ctx.db
      .select({
        id: lists.id,
        userId: lists.userId,
        name: lists.name,
        description: lists.description,
        visibility: lists.visibility,
        // Null when the owner has not chosen a username.
        owner: profiles.username,
      })
      .from(lists)
      .leftJoin(profiles, eq(profiles.userId, lists.userId))
      .where(eq(lists.id, input.id));
    if (!list) throw new TRPCError({ code: "NOT_FOUND" });
    const viewerId = ctx.session?.user.id;
    const isOwner = list.userId === viewerId;
    const allowed =
      isOwner ||
      list.visibility === "public" ||
      (list.visibility === "friends" &&
        viewerId !== undefined &&
        (await areFriends(ctx.db, viewerId, list.userId)));
    if (!allowed) throw new TRPCError({ code: "NOT_FOUND" });

    const items = await ctx.db
      .select({
        mediaId: media.id,
        type: media.type,
        title: media.title,
        releaseYear: media.releaseYear,
        posterUrl: media.posterUrl,
        providerId: media.providerId,
      })
      .from(listItems)
      .innerJoin(media, eq(media.id, listItems.mediaId))
      .where(eq(listItems.listId, list.id))
      .orderBy(listItems.createdAt, media.title);

    const { userId: _userId, ...publicFields } = list;
    return {
      ...publicFields,
      isOwner,
      // Every title with a page has a provider id; this narrows the type for callers.
      items: items.flatMap((item) =>
        item.providerId ? { ...item, providerId: item.providerId } : [],
      ),
    };
  }),

  create: protectedProcedure.input(z.object(details)).mutation(async ({ ctx, input }) => {
    const [list] = await ctx.db
      .insert(lists)
      .values({ userId: ctx.session.user.id, ...input, description: input.description || null })
      .returning({ id: lists.id });
    if (!list) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return list;
  }),

  /** Replaces a list's name and description. Leaving out `visibility` keeps it as is. */
  update: protectedProcedure
    .input(z.object({ id: listId, ...details }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      await requireOwnList(ctx.db, ctx.session.user.id, id);
      await ctx.db
        .update(lists)
        .set({ ...changes, description: changes.description || null })
        .where(eq(lists.id, id));
    }),

  remove: protectedProcedure.input(z.object({ id: listId })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(lists)
      .where(and(eq(lists.id, input.id), eq(lists.userId, ctx.session.user.id)));
  }),

  addItem: protectedProcedure
    .input(z.object({ listId, mediaId }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnList(ctx.db, ctx.session.user.id, input.listId);
      const [title] = await ctx.db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.id, input.mediaId));
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.insert(listItems).values(input).onConflictDoNothing();
      await ctx.db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, input.listId));
    }),

  removeItem: protectedProcedure
    .input(z.object({ listId, mediaId }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnList(ctx.db, ctx.session.user.id, input.listId);
      await ctx.db
        .delete(listItems)
        .where(and(eq(listItems.listId, input.listId), eq(listItems.mediaId, input.mediaId)));
    }),
});

import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { follows, listItems, lists, media, profiles, visibilities } from "@yousiverse/db/schema";
import { and, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { areFriends, visibleToOthers } from "../visibility";

const MAX_LISTS_FROM_FOLLOWING = 24;
/** How many titles a list's tile shows. */
const TILE_TITLES = 4;

const listId = z.uuid();
const mediaId = z.uuid();
const note = z.string().trim().max(280);
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

// Written out with table names: in a query on `lists` alone, column references are generated
// without them, and a bare "id" inside the subquery would mean the item's own id.
export const itemCount = sql<number>`(select count(*)::int from "list_items" where "list_items"."list_id" = "lists"."id")`;

const tileFields = {
  id: lists.id,
  name: lists.name,
  description: lists.description,
  visibility: lists.visibility,
  itemCount,
};

/**
 * Adds to each list its first few titles, in the list's own order, so it can be shown by its
 * artwork. The caller decides which lists the viewer may see; this reads whatever it is given.
 */
export async function withArtwork<List extends { id: string }>(
  db: Database,
  found: List[],
  perList = TILE_TITLES,
) {
  if (found.length === 0) return [];
  const ranked = db
    .select({
      listId: listItems.listId,
      ...titleSummary,
      position:
        sql<number>`row_number() over (partition by ${listItems.listId} order by ${listItems.createdAt}, ${media.title})`.as(
          "position",
        ),
    })
    .from(listItems)
    .innerJoin(media, eq(media.id, listItems.mediaId))
    .where(
      and(
        inArray(
          listItems.listId,
          found.map((list) => list.id),
        ),
        isNotNull(media.providerId),
      ),
    )
    .as("ranked");
  const titles = withPages(
    await db
      .select()
      .from(ranked)
      .where(lte(ranked.position, perList))
      .orderBy(ranked.listId, ranked.position),
  );

  return found.map((list) => ({
    ...list,
    artwork: titles
      .filter((title) => title.listId === list.id)
      .map(({ listId: _listId, position: _position, ...title }) => title),
  }));
}

export const listsRouter = router({
  /** The signed-in person's lists, most recently changed first, each with its first titles. */
  mine: protectedProcedure.query(async ({ ctx }) =>
    withArtwork(
      ctx.db,
      await ctx.db
        .select(tileFields)
        .from(lists)
        .where(eq(lists.userId, ctx.session.user.id))
        .orderBy(desc(lists.updatedAt), lists.name),
    ),
  ),

  /**
   * Lists made by the people the signed-in person follows, most recently changed first. Only
   * lists the viewer may see: public ones, and friends-only ones made by a friend.
   */
  fromFollowing: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id;
    const followed = ctx.db
      .select({ id: follows.followedId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));
    return withArtwork(
      ctx.db,
      await ctx.db
        .select({ ...tileFields, owner: profiles.username })
        .from(lists)
        .innerJoin(profiles, eq(profiles.userId, lists.userId))
        .where(
          and(
            inArray(lists.userId, followed),
            visibleToOthers(viewerId, lists.userId, lists.visibility),
          ),
        )
        .orderBy(desc(lists.updatedAt), lists.name)
        .limit(MAX_LISTS_FROM_FOLLOWING),
    );
  }),

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
        ...titleSummary,
        /** Why the title is on the list, in its maker's words. */
        note: listItems.note,
      })
      .from(listItems)
      .innerJoin(media, eq(media.id, listItems.mediaId))
      .where(eq(listItems.listId, list.id))
      .orderBy(listItems.createdAt, media.title);

    const { userId: _userId, ...publicFields } = list;
    return { ...publicFields, isOwner, items: withPages(items) };
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

  /** Puts a title on a list, with a note if one is given. A title already there is left alone. */
  addItem: protectedProcedure
    .input(z.object({ listId, mediaId, note: note.optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnList(ctx.db, ctx.session.user.id, input.listId);
      const [title] = await ctx.db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.id, input.mediaId));
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .insert(listItems)
        .values({ ...input, note: input.note || null })
        .onConflictDoNothing();
      await ctx.db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, input.listId));
    }),

  /** Writes, changes, or (with null) clears the note on one of a list's titles. */
  setNote: protectedProcedure
    .input(z.object({ listId, mediaId, note: note.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnList(ctx.db, ctx.session.user.id, input.listId);
      const [item] = await ctx.db
        .update(listItems)
        .set({ note: input.note || null })
        .where(and(eq(listItems.listId, input.listId), eq(listItems.mediaId, input.mediaId)))
        .returning({ id: listItems.id });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
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

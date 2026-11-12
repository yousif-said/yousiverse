import { TRPCError } from "@trpc/server";
import {
  libraryEntries,
  libraryStatuses,
  media,
  mediaTypes,
  visibilities,
} from "@yousiverse/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const mediaId = z.uuid();

/** A signed-in person's own library. Nothing here returns another person's entries. */
export const libraryRouter = router({
  entry: protectedProcedure.input(z.object({ mediaId })).query(async ({ ctx, input }) => {
    const [entry] = await ctx.db
      .select({ status: libraryEntries.status, visibility: libraryEntries.visibility })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.userId, ctx.session.user.id),
          eq(libraryEntries.mediaId, input.mediaId),
        ),
      );
    return entry ?? null;
  }),

  /** Adds a title to the library or updates it. Leaving out `visibility` keeps the current one. */
  save: protectedProcedure
    .input(
      z.object({
        mediaId,
        status: z.enum(libraryStatuses),
        visibility: z.enum(visibilities).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [title] = await ctx.db
        .select({ id: media.id })
        .from(media)
        .where(eq(media.id, input.mediaId));
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });

      const changes = { status: input.status, visibility: input.visibility };
      const [entry] = await ctx.db
        .insert(libraryEntries)
        .values({ userId: ctx.session.user.id, mediaId: input.mediaId, ...changes })
        .onConflictDoUpdate({
          target: [libraryEntries.userId, libraryEntries.mediaId],
          set: { ...changes, updatedAt: new Date() },
        })
        .returning({ status: libraryEntries.status, visibility: libraryEntries.visibility });
      if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return entry;
    }),

  remove: protectedProcedure.input(z.object({ mediaId })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .delete(libraryEntries)
      .where(
        and(
          eq(libraryEntries.userId, ctx.session.user.id),
          eq(libraryEntries.mediaId, input.mediaId),
        ),
      );
  }),

  /** Everything in the library, most recently changed first. */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(mediaTypes).optional(),
          status: z.enum(libraryStatuses).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db
        .select({
          status: libraryEntries.status,
          visibility: libraryEntries.visibility,
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
            eq(libraryEntries.userId, ctx.session.user.id),
            input?.type && eq(media.type, input.type),
            input?.status && eq(libraryEntries.status, input.status),
          ),
        )
        .orderBy(desc(libraryEntries.updatedAt), media.title);
      // Every title with a page has a provider id; this narrows the type for callers.
      return entries.flatMap((entry) =>
        entry.providerId ? { ...entry, providerId: entry.providerId } : [],
      );
    }),
});

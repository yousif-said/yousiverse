import { TRPCError } from "@trpc/server";
import {
  episodes,
  episodeWatches,
  libraryEntries,
  libraryStatuses,
  media,
  mediaTypes,
  ratings,
  seasons,
  visibilities,
} from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { progressFor } from "../progress";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, router } from "../trpc";

const mediaId = z.uuid();
const MAX_TITLES_ASKED = 300;
const MAX_TITLES_ADDED = 60;
const MAX_PAGES = 100_000;
// A hundred thousand hours: more than anyone has played anything.
const MAX_MINUTES = 6_000_000;

export const librarySorts = ["recent", "title", "rating", "year"] as const;

/** A signed-in person's own library. Nothing here returns another person's entries. */
export const libraryRouter = router({
  entry: protectedProcedure.input(z.object({ mediaId })).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const [entry] = await ctx.db
      .select({ status: libraryEntries.status, visibility: libraryEntries.visibility })
      .from(libraryEntries)
      .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.mediaId, input.mediaId)));
    if (!entry) return null;
    const progress = await progressFor(ctx.db, userId, [input.mediaId]);
    return { ...entry, progress: progress.get(input.mediaId) ?? null };
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

  /**
   * Adds several titles at once with one status, such as the rest of a universe as "want".
   * Titles already in the library are left exactly as they are. Returns how many were added.
   */
  saveMany: protectedProcedure
    .input(
      z.object({
        mediaIds: z.array(mediaId).min(1).max(MAX_TITLES_ADDED),
        status: z.enum(libraryStatuses),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const titles = await ctx.db
        .select({ id: media.id })
        .from(media)
        .where(inArray(media.id, input.mediaIds));
      if (titles.length === 0) return { added: 0 };
      const added = await ctx.db
        .insert(libraryEntries)
        .values(
          titles.map((title) => ({
            userId: ctx.session.user.id,
            mediaId: title.id,
            status: input.status,
          })),
        )
        .onConflictDoNothing({ target: [libraryEntries.userId, libraryEntries.mediaId] })
        .returning({ id: libraryEntries.id });
      return { added: added.length };
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

  /**
   * Records how far through a book or a game the person is: the page they are on, or the
   * minutes they have played. Null clears it. The title must already be in their library.
   */
  setProgress: protectedProcedure
    .input(
      z.object({
        mediaId,
        pagesRead: z.number().int().min(0).max(MAX_PAGES).nullable().optional(),
        minutesPlayed: z.number().int().min(0).max(MAX_MINUTES).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .update(libraryEntries)
        .set({
          pagesRead: input.pagesRead,
          minutesPlayed: input.minutesPlayed,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(libraryEntries.userId, ctx.session.user.id),
            eq(libraryEntries.mediaId, input.mediaId),
          ),
        )
        .returning({ id: libraryEntries.id });
      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Add this to your library first, then record how far you are.",
        });
      }
    }),

  /** The ids of the episodes of one show that the person has marked as watched. */
  watchedEpisodes: protectedProcedure.input(z.object({ mediaId })).query(async ({ ctx, input }) => {
    const watched = await ctx.db
      .select({ episodeId: episodeWatches.episodeId })
      .from(episodeWatches)
      .innerJoin(episodes, eq(episodes.id, episodeWatches.episodeId))
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .where(
        and(eq(episodeWatches.userId, ctx.session.user.id), eq(seasons.mediaId, input.mediaId)),
      );
    return watched.map((watch) => watch.episodeId);
  }),

  /**
   * Marks one episode as watched or not. Watching an episode of a show that is not in the
   * library, or is only wanted, puts the show in progress; any other status is left alone.
   */
  setWatched: protectedProcedure
    .input(z.object({ episodeId: z.uuid(), watched: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [episode] = await ctx.db
        .select({ mediaId: seasons.mediaId })
        .from(episodes)
        .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
        .where(eq(episodes.id, input.episodeId));
      if (!episode) throw new TRPCError({ code: "NOT_FOUND" });

      if (!input.watched) {
        await ctx.db
          .delete(episodeWatches)
          .where(
            and(eq(episodeWatches.userId, userId), eq(episodeWatches.episodeId, input.episodeId)),
          );
        return;
      }
      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(episodeWatches)
          .values({ userId, episodeId: input.episodeId })
          .onConflictDoNothing({ target: [episodeWatches.userId, episodeWatches.episodeId] });
        await tx
          .insert(libraryEntries)
          .values({ userId, mediaId: episode.mediaId, status: "in_progress" })
          .onConflictDoUpdate({
            target: [libraryEntries.userId, libraryEntries.mediaId],
            set: { status: "in_progress", updatedAt: new Date() },
            setWhere: eq(libraryEntries.status, "want"),
          });
      });
    }),

  /**
   * The person's status for each of these titles, for marking artwork they already have.
   * Titles not in the library are left out.
   */
  statuses: protectedProcedure
    .input(z.object({ mediaIds: z.array(mediaId).max(MAX_TITLES_ASKED) }))
    .query(async ({ ctx, input }) => {
      if (input.mediaIds.length === 0) return [];
      return ctx.db
        .select({ mediaId: libraryEntries.mediaId, status: libraryEntries.status })
        .from(libraryEntries)
        .where(
          and(
            eq(libraryEntries.userId, ctx.session.user.id),
            inArray(libraryEntries.mediaId, input.mediaIds),
          ),
        );
    }),

  /**
   * The library, most recently changed first unless another order is asked for, with the
   * person's own rating of each title and how far through it they are. `counts` covers the
   * whole library whatever the filters, for labeling the choices.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(mediaTypes).optional(),
          status: z.enum(libraryStatuses).optional(),
          sort: z.enum(librarySorts).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const recent = [desc(libraryEntries.updatedAt), asc(media.title)];
      const order = {
        recent,
        title: [asc(media.title)],
        rating: [sql`${ratings.value} desc nulls last`, ...recent],
        year: [sql`${media.releaseYear} desc nulls last`, asc(media.title)],
      }[input?.sort ?? "recent"];

      const [rows, counts] = await Promise.all([
        ctx.db
          .select({
            ...titleSummary,
            status: libraryEntries.status,
            visibility: libraryEntries.visibility,
            updatedAt: libraryEntries.updatedAt,
            /** The person's own rating, in quarter points. */
            rating: ratings.value,
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
          .where(
            and(
              eq(libraryEntries.userId, userId),
              input?.type && eq(media.type, input.type),
              input?.status && eq(libraryEntries.status, input.status),
            ),
          )
          .orderBy(...order),
        ctx.db
          .select({ type: media.type, status: libraryEntries.status, count: count() })
          .from(libraryEntries)
          .innerJoin(media, eq(media.id, libraryEntries.mediaId))
          .where(eq(libraryEntries.userId, userId))
          .groupBy(media.type, libraryEntries.status),
      ]);

      const entries = withPages(rows);
      const underWay = entries.filter((entry) => entry.status === "in_progress");
      const progress = await progressFor(
        ctx.db,
        userId,
        underWay.map((entry) => entry.mediaId),
      );
      return {
        entries: entries.map((entry) => ({
          ...entry,
          progress: progress.get(entry.mediaId) ?? null,
        })),
        counts,
      };
    }),
});

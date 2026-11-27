import { TRPCError } from "@trpc/server";
import { books, libraryEntries, media, ratings, similarTitles } from "@yousiverse/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureSimilar } from "../recommendations/similar";
import { PAGES_PER_HOUR, timeBudgets, titlesForTime } from "../recommendations/time";
import { companionsOf, titlesForTwo } from "../recommendations/together";
import { titleSummary, withPages } from "../titles";
import { protectedProcedure, router } from "../trpc";
import { profileOf, requireProfileOwner } from "./profiles";

/** A title counts as liked from 7 out of 10, in quarter points. */
const LIKED_FROM = 28;
const MAX_LIKED_TITLES = 8;
const TITLES_PER_ROW = 6;

const keyOf = (title: { type: string; providerId: string | null }) =>
  `${title.type}:${title.providerId}`;

export const recommendationsRouter = router({
  /**
   * Titles like the ones the signed-in person rated highest, one row per liked title. Leaves out
   * everything already in their library or rated by them, and shows each suggestion once. A
   * suggestion that is in the catalog and has been rated carries everyone's average.
   */
  forYou: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const seeds = withPages(
      await ctx.db
        .select({ ...titleSummary, rating: ratings.value })
        .from(ratings)
        .innerJoin(media, eq(media.id, ratings.mediaId))
        .where(
          and(
            eq(ratings.userId, userId),
            isNull(ratings.episodeId),
            gte(ratings.value, LIKED_FROM),
            isNotNull(media.providerId),
          ),
        )
        .orderBy(desc(ratings.value), desc(ratings.updatedAt), asc(media.id))
        .limit(MAX_LIKED_TITLES),
    );
    if (seeds.length === 0) return { rows: [], hasLikedTitles: false, incomplete: false };

    // One at a time: several of these can go to the same provider, which limits requests.
    let incomplete = false;
    for (const seed of seeds) {
      const source = { id: seed.mediaId, type: seed.type, providerId: seed.providerId };
      if (!(await ensureSimilar(ctx.db, source))) incomplete = true;
    }

    const seedIds = seeds.map((seed) => seed.mediaId);
    const [similar, known, written] = await Promise.all([
      ctx.db
        .select({
          mediaId: similarTitles.mediaId,
          type: similarTitles.type,
          providerId: similarTitles.providerId,
          title: similarTitles.title,
          releaseYear: similarTitles.releaseYear,
          posterUrl: similarTitles.posterUrl,
          backdropUrl: similarTitles.backdropUrl,
        })
        .from(similarTitles)
        .where(inArray(similarTitles.mediaId, seedIds))
        .orderBy(asc(similarTitles.position)),
      ctx.db
        .select({ type: media.type, providerId: media.providerId })
        .from(media)
        .where(
          or(
            inArray(
              media.id,
              ctx.db
                .select({ mediaId: libraryEntries.mediaId })
                .from(libraryEntries)
                .where(eq(libraryEntries.userId, userId)),
            ),
            inArray(
              media.id,
              ctx.db
                .select({ mediaId: ratings.mediaId })
                .from(ratings)
                .where(eq(ratings.userId, userId)),
            ),
          ),
        ),
      // A book's row is its author's other books, so the row is headed with the author's name.
      // Read after the similar titles, which is when a book's details are sure to be stored.
      ctx.db
        .select({ mediaId: books.mediaId, authors: books.authors })
        .from(books)
        .where(inArray(books.mediaId, seedIds)),
    ]);

    const taken = new Set(known.map(keyOf));
    const authorOf = new Map(written.map((book) => [book.mediaId, book.authors[0] ?? null]));
    const suggested = seeds.flatMap((seed) => {
      const titles = [];
      for (const { mediaId, ...title } of similar) {
        if (mediaId !== seed.mediaId || taken.has(keyOf(title))) continue;
        taken.add(keyOf(title));
        titles.push(title);
        if (titles.length === TITLES_PER_ROW) break;
      }
      const author = authorOf.get(seed.mediaId) ?? null;
      return titles.length > 0 ? { seed: { ...seed, author }, titles } : [];
    });

    const providerIds = suggested.flatMap((row) => row.titles.map((title) => title.providerId));
    const rated =
      providerIds.length === 0
        ? []
        : await ctx.db
            .select({
              type: media.type,
              providerId: media.providerId,
              average: sql<number>`avg(${ratings.value})::float`,
            })
            .from(ratings)
            .innerJoin(media, eq(media.id, ratings.mediaId))
            .where(and(isNull(ratings.episodeId), inArray(media.providerId, providerIds)))
            .groupBy(media.type, media.providerId);
    const averageOf = new Map(rated.map((title) => [keyOf(title), title.average]));

    const rows = suggested.map(({ seed, titles }) => ({
      seed,
      titles: titles.map((title) => ({
        ...title,
        /** Everyone's average in quarter points, or null when nobody here has rated it. */
        average: averageOf.get(keyOf(title)) ?? null,
      })),
    }));
    return { rows, hasLikedTitles: true, incomplete };
  }),

  /**
   * "How long have you got?": titles from the person's own want list and what they are partway
   * through that fit a stretch of time. `pagesPerHour` is the reading pace books were sized at.
   */
  forTime: protectedProcedure
    .input(z.object({ budget: z.enum(timeBudgets) }))
    .query(async ({ ctx, input }) => ({
      picks: await titlesForTime(ctx.db, ctx.session.user.id, input.budget),
      pagesPerHour: PAGES_PER_HOUR,
    })),

  /** The people the signed-in person follows, to choose one for "Something for two". */
  companions: protectedProcedure.query(({ ctx }) => companionsOf(ctx.db, ctx.session.user.id)),

  /**
   * "Something for two": what the signed-in person and one other would both enjoy, each with
   * its reason. `rating` belongs to the other person, except for `you_rated_they_want`, where
   * it is the signed-in person's own. Only what the other lets this viewer see is used.
   */
  forTwo: protectedProcedure.input(profileOf).query(async ({ ctx, input }) => {
    const viewerId = ctx.session.user.id;
    const otherId = await requireProfileOwner(ctx.db, input.username);
    if (otherId === viewerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose someone other than yourself." });
    }
    return titlesForTwo(ctx.db, viewerId, otherId);
  }),
});

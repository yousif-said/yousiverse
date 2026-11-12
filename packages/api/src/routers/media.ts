import { TRPCError } from "@trpc/server";
import { books, episodes, games, media, movies, seasons, tvShows } from "@yousiverse/db/schema";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { ensureImported } from "../catalog/import";
import { publicProcedure, router } from "../trpc";

const providerId = z.string().regex(/^\d{1,12}$/);
const openLibraryWorkId = z.string().regex(/^OL\d{1,12}W$/);

const mediaFields = {
  id: media.id,
  providerId: media.providerId,
  title: media.title,
  overview: media.overview,
  releaseDate: media.releaseDate,
  releaseYear: media.releaseYear,
  posterUrl: media.posterUrl,
  backdropUrl: media.backdropUrl,
  genres: media.genres,
};

export const mediaRouter = router({
  /** The titles most recently added to the catalog. */
  shelf: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select({
        id: media.id,
        type: media.type,
        title: media.title,
        releaseYear: media.releaseYear,
        providerId: media.providerId,
      })
      .from(media)
      .where(isNotNull(media.providerId))
      .orderBy(desc(media.createdAt), media.title)
      .limit(24);
    // The filter above guarantees an id; this narrows the type for callers.
    return items.flatMap((item) =>
      item.providerId ? { ...item, providerId: item.providerId } : [],
    );
  }),

  movie: publicProcedure.input(z.object({ providerId })).query(async ({ ctx, input }) => {
    const mediaId = await ensureImported(ctx.db, { type: "movie", providerId: input.providerId });
    const [movie] = await ctx.db
      .select({ ...mediaFields, tagline: movies.tagline, runtimeMinutes: movies.runtimeMinutes })
      .from(media)
      .innerJoin(movies, eq(movies.mediaId, media.id))
      .where(eq(media.id, mediaId));
    if (!movie) throw new TRPCError({ code: "NOT_FOUND" });
    return movie;
  }),

  game: publicProcedure.input(z.object({ providerId })).query(async ({ ctx, input }) => {
    const mediaId = await ensureImported(ctx.db, { type: "game", providerId: input.providerId });
    const [game] = await ctx.db
      .select({
        ...mediaFields,
        platforms: games.platforms,
        developers: games.developers,
        publishers: games.publishers,
      })
      .from(media)
      .innerJoin(games, eq(games.mediaId, media.id))
      .where(eq(media.id, mediaId));
    if (!game) throw new TRPCError({ code: "NOT_FOUND" });
    return game;
  }),

  /**
   * Open Library merges duplicate works, so the book returned can have a different
   * `providerId` from the one asked for. Callers should send visitors to the returned id.
   */
  book: publicProcedure
    .input(z.object({ providerId: openLibraryWorkId }))
    .query(async ({ ctx, input }) => {
      const mediaId = await ensureImported(ctx.db, { type: "book", providerId: input.providerId });
      const [book] = await ctx.db
        .select({ ...mediaFields, authors: books.authors, pageCount: books.pageCount })
        .from(media)
        .innerJoin(books, eq(books.mediaId, media.id))
        .where(eq(media.id, mediaId));
      if (!book) throw new TRPCError({ code: "NOT_FOUND" });
      return book;
    }),

  tvShow: publicProcedure.input(z.object({ providerId })).query(async ({ ctx, input }) => {
    const mediaId = await ensureImported(ctx.db, { type: "tv", providerId: input.providerId });
    const [[show], showSeasons] = await Promise.all([
      ctx.db
        .select({ ...mediaFields, tagline: tvShows.tagline, status: tvShows.status })
        .from(media)
        .innerJoin(tvShows, eq(tvShows.mediaId, media.id))
        .where(eq(media.id, mediaId)),
      ctx.db
        .select({
          seasonNumber: seasons.seasonNumber,
          name: seasons.name,
          airDate: seasons.airDate,
          posterUrl: seasons.posterUrl,
          episodeCount: count(episodes.id),
        })
        .from(seasons)
        .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
        .where(eq(seasons.mediaId, mediaId))
        .groupBy(seasons.id)
        .orderBy(seasons.seasonNumber),
    ]);
    if (!show) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...show, seasons: showSeasons };
  }),

  season: publicProcedure
    .input(z.object({ providerId, seasonNumber: z.number().int().min(0).max(10_000) }))
    .query(async ({ ctx, input }) => {
      const mediaId = await ensureImported(ctx.db, { type: "tv", providerId: input.providerId });
      const [season] = await ctx.db
        .select({
          id: seasons.id,
          seasonNumber: seasons.seasonNumber,
          name: seasons.name,
          overview: seasons.overview,
          airDate: seasons.airDate,
          posterUrl: seasons.posterUrl,
          show: { providerId: media.providerId, title: media.title },
        })
        .from(seasons)
        .innerJoin(media, eq(media.id, seasons.mediaId))
        .where(and(eq(seasons.mediaId, mediaId), eq(seasons.seasonNumber, input.seasonNumber)));
      if (!season) throw new TRPCError({ code: "NOT_FOUND" });

      const seasonEpisodes = await ctx.db
        .select({
          id: episodes.id,
          episodeNumber: episodes.episodeNumber,
          name: episodes.name,
          overview: episodes.overview,
          airDate: episodes.airDate,
          runtimeMinutes: episodes.runtimeMinutes,
          stillUrl: episodes.stillUrl,
        })
        .from(episodes)
        .where(eq(episodes.seasonId, season.id))
        .orderBy(episodes.episodeNumber);
      return { ...season, episodes: seasonEpisodes };
    }),
});

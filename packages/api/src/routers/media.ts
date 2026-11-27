import { TRPCError } from "@trpc/server";
import { books, episodes, games, media, movies, seasons, tvShows } from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureImported } from "../catalog/import";
import { publicProcedure, router } from "../trpc";

const providerId = z.string().regex(/^\d{1,12}$/);
const openLibraryWorkId = z.string().regex(/^OL\d{1,12}W$/);
/** A season's or episode's number within its show or season. Specials are season 0. */
const positionNumber = z.number().int().min(0).max(10_000);

const mediaFields = {
  id: media.id,
  providerId: media.providerId,
  title: media.title,
  overview: media.overview,
  releaseDate: media.releaseDate,
  releaseYear: media.releaseYear,
  posterUrl: media.posterUrl,
  backdropUrl: media.backdropUrl,
  artHue: media.artHue,
  artSaturation: media.artSaturation,
  posterAspect: media.posterAspect,
  genres: media.genres,
};

/** The show a season or an episode belongs to, with its artwork for the page's light and color. */
const showFields = {
  mediaId: media.id,
  title: media.title,
  posterUrl: media.posterUrl,
  backdropUrl: media.backdropUrl,
  artHue: media.artHue,
  artSaturation: media.artSaturation,
};

const episodeFields = {
  id: episodes.id,
  episodeNumber: episodes.episodeNumber,
  name: episodes.name,
  overview: episodes.overview,
  airDate: episodes.airDate,
  runtimeMinutes: episodes.runtimeMinutes,
  stillUrl: episodes.stillUrl,
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
    .input(z.object({ providerId, seasonNumber: positionNumber }))
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
          show: showFields,
        })
        .from(seasons)
        .innerJoin(media, eq(media.id, seasons.mediaId))
        .where(and(eq(seasons.mediaId, mediaId), eq(seasons.seasonNumber, input.seasonNumber)));
      if (!season) throw new TRPCError({ code: "NOT_FOUND" });

      const seasonEpisodes = await ctx.db
        .select(episodeFields)
        .from(episodes)
        .where(eq(episodes.seasonId, season.id))
        .orderBy(episodes.episodeNumber);
      return {
        ...season,
        show: { ...season.show, providerId: input.providerId },
        episodes: seasonEpisodes,
      };
    }),

  /**
   * Every season of a show with its episodes, in order, read from what is stored: the page that
   * shows them has already loaded the show. Empty for a title that has no seasons.
   */
  episodes: publicProcedure.input(z.object({ mediaId: z.uuid() })).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        seasonNumber: seasons.seasonNumber,
        seasonName: seasons.name,
        episode: episodeFields,
      })
      .from(seasons)
      .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
      .where(eq(seasons.mediaId, input.mediaId))
      .orderBy(asc(seasons.seasonNumber), asc(episodes.episodeNumber));

    type Episode = NonNullable<(typeof rows)[number]["episode"]>;
    const bySeason = new Map<number, { seasonNumber: number; name: string; episodes: Episode[] }>();
    for (const { seasonNumber, seasonName, episode } of rows) {
      const season = bySeason.get(seasonNumber) ?? { seasonNumber, name: seasonName, episodes: [] };
      if (episode) season.episodes.push(episode);
      bySeason.set(seasonNumber, season);
    }
    return [...bySeason.values()];
  }),

  /** One episode, with the numbers of the episodes before and after it in its season. */
  episode: publicProcedure
    .input(z.object({ providerId, seasonNumber: positionNumber, episodeNumber: positionNumber }))
    .query(async ({ ctx, input }) => {
      const mediaId = await ensureImported(ctx.db, { type: "tv", providerId: input.providerId });
      const [episode] = await ctx.db
        .select({
          ...episodeFields,
          seasonId: episodes.seasonId,
          season: { seasonNumber: seasons.seasonNumber, name: seasons.name },
          show: showFields,
        })
        .from(episodes)
        .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
        .innerJoin(media, eq(media.id, seasons.mediaId))
        .where(
          and(
            eq(seasons.mediaId, mediaId),
            eq(seasons.seasonNumber, input.seasonNumber),
            eq(episodes.episodeNumber, input.episodeNumber),
          ),
        );
      if (!episode) throw new TRPCError({ code: "NOT_FOUND" });

      const { seasonId, show, ...found } = episode;
      const [neighbors] = await ctx.db
        .select({
          previous: sql<
            number | null
          >`max(${episodes.episodeNumber}) filter (where ${episodes.episodeNumber} < ${input.episodeNumber})`,
          next: sql<
            number | null
          >`min(${episodes.episodeNumber}) filter (where ${episodes.episodeNumber} > ${input.episodeNumber})`,
        })
        .from(episodes)
        .where(eq(episodes.seasonId, seasonId));
      return {
        ...found,
        show: { ...show, providerId: input.providerId },
        /** Episode numbers within the same season. Null at either end of it. */
        previous: neighbors?.previous ?? null,
        next: neighbors?.next ?? null,
      };
    }),
});

import type { Database } from "@yousiverse/db";
import { episodes, media, movies, seasons, tvShows } from "@yousiverse/db/schema";
import type { CatalogItem, CatalogMovie, CatalogTvShow } from "@yousiverse/integrations/catalog";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { and, eq, sql } from "drizzle-orm";

const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type CatalogRef = { type: "movie" | "tv"; providerId: string };

/** For bulk upserts: sets each column to the value from the row that conflicted. */
function fromIncomingRow<Column extends string>(columns: Column[]) {
  const toSnakeCase = (name: string) => name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  return Object.fromEntries(
    columns.map((column) => [column, sql.raw(`excluded."${toSnakeCase(column)}"`)]),
  ) as Record<Column, ReturnType<typeof sql.raw>>;
}

async function saveMedia(tx: Transaction, type: CatalogRef["type"], item: CatalogItem) {
  const values = {
    title: item.title,
    overview: item.overview,
    releaseDate: item.releaseDate,
    releaseYear: item.releaseYear,
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    genres: item.genres,
    syncedAt: new Date(),
  };
  const [saved] = await tx
    .insert(media)
    .values({ ...values, type, provider: "tmdb", providerId: item.providerId })
    .onConflictDoUpdate({ target: [media.provider, media.type, media.providerId], set: values })
    .returning({ id: media.id });
  if (!saved) throw new Error(`Saving ${type} ${item.providerId} returned no row.`);
  return saved.id;
}

function saveMovie(db: Database, movie: CatalogMovie) {
  return db.transaction(async (tx) => {
    const mediaId = await saveMedia(tx, "movie", movie);
    const details = { tagline: movie.tagline, runtimeMinutes: movie.runtimeMinutes };
    await tx
      .insert(movies)
      .values({ mediaId, ...details })
      .onConflictDoUpdate({ target: movies.mediaId, set: details });
    return mediaId;
  });
}

function saveTvShow(db: Database, show: CatalogTvShow) {
  return db.transaction(async (tx) => {
    const mediaId = await saveMedia(tx, "tv", show);
    const details = { tagline: show.tagline, status: show.status };
    await tx
      .insert(tvShows)
      .values({ mediaId, ...details })
      .onConflictDoUpdate({ target: tvShows.mediaId, set: details });

    // Seasons and episodes are updated in place and never deleted, so ratings and reviews
    // attached to them survive a refresh.
    if (show.seasons.length === 0) return mediaId;
    const savedSeasons = await tx
      .insert(seasons)
      .values(show.seasons.map(({ episodes: _, ...season }) => ({ mediaId, ...season })))
      .onConflictDoUpdate({
        target: [seasons.mediaId, seasons.seasonNumber],
        set: fromIncomingRow(["name", "overview", "airDate", "posterUrl"]),
      })
      .returning({ id: seasons.id, seasonNumber: seasons.seasonNumber });
    const seasonIds = new Map(savedSeasons.map((season) => [season.seasonNumber, season.id]));

    const episodeRows = show.seasons.flatMap((season) => {
      const seasonId = seasonIds.get(season.seasonNumber);
      return seasonId ? season.episodes.map((episode) => ({ seasonId, ...episode })) : [];
    });
    if (episodeRows.length === 0) return mediaId;
    await tx
      .insert(episodes)
      .values(episodeRows)
      .onConflictDoUpdate({
        target: [episodes.seasonId, episodes.episodeNumber],
        set: fromIncomingRow(["name", "overview", "airDate", "runtimeMinutes", "stillUrl"]),
      });
    return mediaId;
  });
}

/**
 * Returns the media id for a provider item, importing it on first use and refreshing it once
 * the stored copy is older than a week.
 */
export async function ensureImported(db: Database, ref: CatalogRef): Promise<string> {
  const [stored] = await db
    .select({ id: media.id, syncedAt: media.syncedAt })
    .from(media)
    .where(
      and(
        eq(media.provider, "tmdb"),
        eq(media.type, ref.type),
        eq(media.providerId, ref.providerId),
      ),
    );
  if (stored?.syncedAt && Date.now() - stored.syncedAt.getTime() < REFRESH_AFTER_MS) {
    return stored.id;
  }

  try {
    return ref.type === "movie"
      ? await saveMovie(db, await tmdb.getMovie(ref.providerId))
      : await saveTvShow(db, await tmdb.getTvShow(ref.providerId));
  } catch (error) {
    // A stored copy that is out of date is better than an error page while a provider is down.
    if (stored?.syncedAt && error instanceof ProviderError && error.kind !== "not_found") {
      console.warn(`Serving stored ${ref.type} ${ref.providerId}; refresh failed.`, error);
      return stored.id;
    }
    throw error;
  }
}

import type { Database } from "@yousiverse/db";
import {
  books,
  episodes,
  episodeWatches,
  libraryEntries,
  media,
  seasons,
} from "@yousiverse/db/schema";
import { and, asc, eq, gt, inArray } from "drizzle-orm";

/** The episode a person is up to in a show: the first one they have not watched. */
export type NextEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  /** Null when no date has been announced. */
  airDate: string | null;
  /** How many episodes its season has, and how many of them the person has watched. */
  inSeason: number;
  watchedInSeason: number;
};

/** How far a person is through one title, in the measure that fits its medium. */
export type Progress =
  | { kind: "episodes"; watched: number; total: number; next: NextEpisode | null }
  | { kind: "pages"; read: number; of: number | null }
  | { kind: "minutes"; played: number };

/**
 * How far one person is through each of these titles. A title is left out when there is nothing
 * to say: a movie, a show with no episodes watched, a book or game with nothing recorded.
 * Specials (season 0) do not count toward a show.
 */
export async function progressFor(
  db: Database,
  userId: string,
  mediaIds: string[],
): Promise<Map<string, Progress>> {
  const progress = new Map<string, Progress>();
  if (mediaIds.length === 0) return progress;

  const [recorded, showEpisodes] = await Promise.all([
    db
      .select({
        mediaId: libraryEntries.mediaId,
        pagesRead: libraryEntries.pagesRead,
        minutesPlayed: libraryEntries.minutesPlayed,
        pageCount: books.pageCount,
      })
      .from(libraryEntries)
      .leftJoin(books, eq(books.mediaId, libraryEntries.mediaId))
      .where(and(eq(libraryEntries.userId, userId), inArray(libraryEntries.mediaId, mediaIds))),
    db
      .select({
        mediaId: seasons.mediaId,
        seasonNumber: seasons.seasonNumber,
        episodeNumber: episodes.episodeNumber,
        name: episodes.name,
        airDate: episodes.airDate,
        watchedAt: episodeWatches.createdAt,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(media, and(eq(media.id, seasons.mediaId), eq(media.type, "tv")))
      .leftJoin(
        episodeWatches,
        and(eq(episodeWatches.episodeId, episodes.id), eq(episodeWatches.userId, userId)),
      )
      .where(and(inArray(seasons.mediaId, mediaIds), gt(seasons.seasonNumber, 0)))
      .orderBy(asc(seasons.mediaId), asc(seasons.seasonNumber), asc(episodes.episodeNumber)),
  ]);

  for (const entry of recorded) {
    if (entry.pagesRead !== null) {
      progress.set(entry.mediaId, { kind: "pages", read: entry.pagesRead, of: entry.pageCount });
    } else if (entry.minutesPlayed !== null) {
      progress.set(entry.mediaId, { kind: "minutes", played: entry.minutesPlayed });
    }
  }

  const byShow = new Map<string, typeof showEpisodes>();
  for (const episode of showEpisodes) {
    const all = byShow.get(episode.mediaId);
    if (all) all.push(episode);
    else byShow.set(episode.mediaId, [episode]);
  }
  for (const [mediaId, all] of byShow) {
    const watched = all.filter((episode) => episode.watchedAt !== null).length;
    if (watched === 0) continue;
    const upNext = all.find((episode) => episode.watchedAt === null);
    const season = upNext ? all.filter((e) => e.seasonNumber === upNext.seasonNumber) : [];
    progress.set(mediaId, {
      kind: "episodes",
      watched,
      total: all.length,
      next: upNext
        ? {
            seasonNumber: upNext.seasonNumber,
            episodeNumber: upNext.episodeNumber,
            name: upNext.name,
            airDate: upNext.airDate,
            inSeason: season.length,
            watchedInSeason: season.filter((episode) => episode.watchedAt !== null).length,
          }
        : null,
    });
  }
  return progress;
}

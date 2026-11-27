import type { Database } from "@yousiverse/db";
import {
  books,
  episodes,
  episodeWatches,
  libraryEntries,
  media,
  movies,
  seasons,
} from "@yousiverse/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { usToday } from "../calendar/dates";
import { titleSummary, withPages } from "../titles";

export const timeBudgets = ["hour", "two", "evening", "weekend"] as const;
export type TimeBudget = (typeof timeBudgets)[number];

/** The most that fits each stretch, in minutes, with a little slack: a 125 minute film fits two hours. */
const LIMIT_MINUTES: Record<TimeBudget, number> = {
  hour: 65,
  two: 125,
  evening: 190,
  weekend: 720,
};
/** How fast a book is assumed to be read. The page says so next to its picks. */
export const PAGES_PER_HOUR = 40;
const MAX_PICKS = 12;

/** Why a title fits: the film's length, the next episodes that fit, or the pages left to read. */
export type TimeFit =
  | { kind: "movie"; minutes: number }
  | {
      kind: "episodes";
      /** The first episode of the run: the next one the person has not watched. */
      seasonNumber: number;
      episodeNumber: number;
      count: number;
      minutes: number;
    }
  | { kind: "pages"; pages: number; started: boolean };

/**
 * Titles the person wants or is partway through that fit the time they have: a film by its
 * length, a show by as many of its next episodes as fit, and a book by the pages left at
 * `PAGES_PER_HOUR`. A weekend holds only what an evening cannot. Games are left out: nothing
 * says how long one takes. What is under way comes first, then the most recently added.
 */
export async function titlesForTime(db: Database, userId: string, budget: TimeBudget) {
  const limit = LIMIT_MINUTES[budget];
  const moreThan = budget === "weekend" ? LIMIT_MINUTES.evening : 0;
  const fitsIn = (minutes: number) => minutes > moreThan && minutes <= limit;
  const today = usToday();

  const entries = withPages(
    await db
      .select({
        ...titleSummary,
        status: libraryEntries.status,
        pagesRead: libraryEntries.pagesRead,
        releaseDate: media.releaseDate,
        runtimeMinutes: movies.runtimeMinutes,
        pageCount: books.pageCount,
      })
      .from(libraryEntries)
      .innerJoin(media, eq(media.id, libraryEntries.mediaId))
      .leftJoin(movies, eq(movies.mediaId, media.id))
      .leftJoin(books, eq(books.mediaId, media.id))
      .where(
        and(
          eq(libraryEntries.userId, userId),
          inArray(libraryEntries.status, ["in_progress", "want"]),
          ne(media.type, "game"),
        ),
      )
      .orderBy(desc(libraryEntries.updatedAt), asc(media.title)),
  );

  const showIds = entries.filter((entry) => entry.type === "tv").map((entry) => entry.mediaId);
  const unwatched =
    showIds.length === 0
      ? []
      : await db
          .select({
            mediaId: seasons.mediaId,
            seasonNumber: seasons.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            airDate: episodes.airDate,
            runtimeMinutes: episodes.runtimeMinutes,
          })
          .from(episodes)
          .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
          .leftJoin(
            episodeWatches,
            and(eq(episodeWatches.episodeId, episodes.id), eq(episodeWatches.userId, userId)),
          )
          // Specials (season 0) do not count toward a show, as in its progress.
          .where(
            and(
              inArray(seasons.mediaId, showIds),
              gt(seasons.seasonNumber, 0),
              isNull(episodeWatches.id),
            ),
          )
          .orderBy(asc(seasons.mediaId), asc(seasons.seasonNumber), asc(episodes.episodeNumber));

  /** As many of a show's next episodes as fit, stopping at one that has not aired or has no length. */
  function episodesThatFit(mediaId: string): TimeFit | null {
    let count = 0;
    let minutes = 0;
    let first: (typeof unwatched)[number] | undefined;
    for (const episode of unwatched) {
      if (episode.mediaId !== mediaId) continue;
      const aired = episode.airDate !== null && episode.airDate <= today;
      if (!aired || !episode.runtimeMinutes || minutes + episode.runtimeMinutes > limit) break;
      first ??= episode;
      count += 1;
      minutes += episode.runtimeMinutes;
    }
    if (!first || !fitsIn(minutes)) return null;
    const { seasonNumber, episodeNumber } = first;
    return { kind: "episodes", seasonNumber, episodeNumber, count, minutes };
  }

  function fitOf(entry: (typeof entries)[number]): TimeFit | null {
    switch (entry.type) {
      case "tv":
        return episodesThatFit(entry.mediaId);
      case "movie": {
        const released = entry.releaseDate === null || entry.releaseDate <= today;
        return released && entry.runtimeMinutes && fitsIn(entry.runtimeMinutes)
          ? { kind: "movie", minutes: entry.runtimeMinutes }
          : null;
      }
      case "book": {
        if (!entry.pageCount) return null;
        const pages = entry.pageCount - (entry.pagesRead ?? 0);
        return pages > 0 && fitsIn(Math.ceil((pages * 60) / PAGES_PER_HOUR))
          ? { kind: "pages", pages, started: (entry.pagesRead ?? 0) > 0 }
          : null;
      }
      case "game":
        return null;
    }
  }

  const picks = entries.flatMap((entry) => {
    const fit = fitOf(entry);
    if (!fit) return [];
    const { pagesRead, releaseDate, runtimeMinutes, pageCount, ...title } = entry;
    return { ...title, fit };
  });
  const underWay = picks.filter((pick) => pick.status === "in_progress");
  const wanted = picks.filter((pick) => pick.status !== "in_progress");
  return [...underWay, ...wanted].slice(0, MAX_PICKS);
}

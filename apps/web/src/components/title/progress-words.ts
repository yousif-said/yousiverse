import { midSentence, untilLabel } from "../../lib/days";
import { pluralize } from "../../lib/format";
import type { LibraryEntry } from "../../lib/library";

type Progress = NonNullable<LibraryEntry["progress"]>;

/** Minutes as hours to one decimal place: 3720 is 62, 90 is 1.5. */
export const hoursOf = (minutes: number) => Math.round(minutes / 6) / 10;

/**
 * How far through a title someone is, in words, and how full to draw the bar: 0 to 100, or
 * null when there is nothing to measure against. A show is measured within the season of the
 * next episode.
 */
export function progressInWords(
  progress: Progress,
  today: string,
): { text: string; value: number | null } {
  switch (progress.kind) {
    case "episodes": {
      const { next } = progress;
      if (!next) return { text: "All caught up", value: 100 };
      const episode = `Season ${next.seasonNumber}, episode ${next.episodeNumber}`;
      const value = (next.watchedInSeason / next.inSeason) * 100;
      if (!next.airDate) return { text: `${episode} has no date yet`, value };
      return next.airDate <= today
        ? { text: `${episode} is next`, value }
        : { text: `${episode} airs ${midSentence(untilLabel(next.airDate, today))}`, value };
    }
    case "pages":
      return progress.of
        ? {
            text: `Page ${progress.read} of ${progress.of}`,
            value: Math.min(100, (progress.read / progress.of) * 100),
          }
        : { text: `Page ${progress.read}`, value: null };
    case "minutes":
      return { text: `${pluralize(hoursOf(progress.played), "hour")} played`, value: null };
  }
}

import type { RouterOutputs } from "@yousiverse/api";
import type { IconName } from "@/components/ui/icon";
import { midSentence, untilLabel } from "./days";
import { pluralize } from "./format";
import type { LibraryStatus } from "./library";
import type { MediaType } from "./media";
import type { Visibility } from "./visibility";

export type LibraryListEntry = RouterOutputs["library"]["list"]["entries"][number];
export type Progress = NonNullable<LibraryListEntry["progress"]>;

/** The two ways to look at the library: shelves grouped by status, or a board to move titles on. */
export const LIBRARY_VIEWS = ["grid", "board"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

/** The orders the library offers, in the words for each. The first is the default. */
export const SORT_LABELS = { recent: "Recent", rating: "Your rating", title: "A to Z" } as const;
export type LibrarySort = keyof typeof SORT_LABELS;
export const LIBRARY_SORTS = Object.keys(SORT_LABELS) as LibrarySort[];

export function isLibraryView(value: unknown): value is LibraryView {
  return LIBRARY_VIEWS.includes(value as LibraryView);
}

export function isLibrarySort(value: unknown): value is LibrarySort {
  return LIBRARY_SORTS.includes(value as LibrarySort);
}

export type LibraryChoices = {
  type?: MediaType;
  status?: LibraryStatus;
  sort?: LibrarySort;
  view?: LibraryView;
};

/**
 * The library's address with these choices made. A default (most recent first, as shelves) is
 * left out, so the plain library stays at `/library` and older links keep their meaning.
 */
export function libraryViewPath({ type, status, sort, view }: LibraryChoices = {}): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (sort && sort !== "recent") params.set("sort", sort);
  if (view && view !== "grid") params.set("view", view);
  return params.size > 0 ? `/library?${params}` : "/library";
}

/** How an entry that not everyone can see is marked for its owner. */
export const LIMITED_TO: Record<
  Exclude<Visibility, "public">,
  { label: string; icon: IconName }
> = {
  friends: { label: "Friends only", icon: "clubs" },
  private: { label: "Only you", icon: "lock" },
};

type ProgressLine = {
  text: string;
  /** How far through, 0 to 100. Null when there is no total to measure against. */
  percent: number | null;
};

/**
 * How far through a title its owner is, in words: "Season 2, episode 7 is next", "Page 141 of
 * 279", "38 hours played". A show is measured within the season the person is in.
 */
export function progressLine(progress: Progress, today: string): ProgressLine {
  switch (progress.kind) {
    case "episodes": {
      const { next } = progress;
      if (!next) return { text: "All caught up", percent: 100 };
      const episode = `Season ${next.seasonNumber}, episode ${next.episodeNumber}`;
      const percent = (next.watchedInSeason / next.inSeason) * 100;
      if (!next.airDate) return { text: `${episode} has no date yet`, percent };
      const text =
        next.airDate <= today
          ? `${episode} is next`
          : `${episode} airs ${midSentence(untilLabel(next.airDate, today))}`;
      return { text, percent };
    }
    case "pages":
      return progress.of
        ? {
            text: `Page ${progress.read} of ${progress.of}`,
            percent: Math.min(100, (progress.read / progress.of) * 100),
          }
        : { text: `Page ${progress.read}`, percent: null };
    case "minutes": {
      const played =
        progress.played < 60
          ? pluralize(progress.played, "minute")
          : pluralize(Math.round(progress.played / 60), "hour");
      return { text: `${played} played`, percent: null };
    }
  }
}

/**
 * Changes made on the board that the list from the server does not show yet, by media id, in
 * the order they were made. A status moves the title to that column; null takes it out of the
 * library.
 */
export type BoardMoves = ReadonlyMap<string, LibraryStatus | null>;

type Movable = { mediaId: string; status: LibraryStatus };

/** Adds a move as the latest one, replacing any earlier move of the same title. */
export function withMove(
  moves: BoardMoves,
  mediaId: string,
  status: LibraryStatus | null,
): BoardMoves {
  const next = new Map(moves);
  next.delete(mediaId);
  next.set(mediaId, status);
  return next;
}

/** Takes a move back, as when saving it failed. */
export function withoutMove(moves: BoardMoves, mediaId: string): BoardMoves {
  const next = new Map(moves);
  next.delete(mediaId);
  return next;
}

/**
 * The moves a newly arrived list does not show yet. One it does show is dropped, so that it can
 * never hide a later change made somewhere else. Returns the same map when nothing is dropped.
 */
export function movesStillWaiting(moves: BoardMoves, entries: Movable[]): BoardMoves {
  const stored = new Map(entries.map((entry) => [entry.mediaId, entry.status]));
  const waiting = new Map(
    [...moves].filter(([mediaId, status]) => (stored.get(mediaId) ?? null) !== status),
  );
  return waiting.size === moves.size ? moves : waiting;
}

/**
 * The list as the board shows it while moves are being saved: each moved title in its new
 * column, each removed one gone. Most recent first, a title just moved leads, as it will once
 * the server has stored the move.
 */
export function applyMoves<Entry extends Movable>(
  entries: Entry[],
  moves: BoardMoves,
  sort: LibrarySort,
): Entry[] {
  const shown = entries.flatMap((entry) => {
    const status = moves.get(entry.mediaId);
    if (status === undefined) return entry;
    return status ? { ...entry, status } : [];
  });
  if (sort !== "recent") return shown;
  const order = [...moves.keys()];
  return shown.sort((a, b) => order.indexOf(b.mediaId) - order.indexOf(a.mediaId));
}

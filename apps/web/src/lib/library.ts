import type { RouterOutputs } from "@yousiverse/api";
import type { IconName } from "@/components/ui/icon";
import type { MediaType } from "./media";

type Entry = NonNullable<RouterOutputs["library"]["entry"]>;
export type LibraryStatus = Entry["status"];
export type LibraryEntry = Entry;

/** Status names for a library holding every type of title together. */
export const STATUS_LABELS: Record<LibraryStatus, string> = {
  want: "Want",
  in_progress: "In progress",
  finished: "Finished",
  dropped: "Dropped",
};

export const LIBRARY_STATUSES = Object.keys(STATUS_LABELS) as LibraryStatus[];

export function isLibraryStatus(value: unknown): value is LibraryStatus {
  return LIBRARY_STATUSES.includes(value as LibraryStatus);
}

export const STATUS_ICONS: Record<LibraryStatus, IconName> = {
  want: "bookmark",
  in_progress: "play",
  finished: "check",
  dropped: "x",
};

/** The order shelves and boards show statuses in: what is under way, what is next, what is done. */
export const SHELF_ORDER: LibraryStatus[] = ["in_progress", "want", "finished", "dropped"];

const VERBS: Record<MediaType, Record<LibraryStatus, string>> = {
  movie: {
    want: "Want to watch",
    in_progress: "Watching",
    finished: "Watched",
    dropped: "Dropped",
  },
  tv: { want: "Want to watch", in_progress: "Watching", finished: "Finished", dropped: "Dropped" },
  game: { want: "Want to play", in_progress: "Playing", finished: "Finished", dropped: "Dropped" },
  book: { want: "Want to read", in_progress: "Reading", finished: "Read", dropped: "Dropped" },
};

/** A status in the words that fit one type of title: "Want to read", "Playing", "Watched". */
export function statusLabel(status: LibraryStatus, type: MediaType): string {
  return VERBS[type][status];
}

const ACTIVITY: Record<MediaType, Record<LibraryStatus, string>> = {
  movie: {
    want: "wants to watch",
    in_progress: "is watching",
    finished: "watched",
    dropped: "dropped",
  },
  tv: {
    want: "wants to watch",
    in_progress: "is watching",
    finished: "finished",
    dropped: "dropped",
  },
  game: {
    want: "wants to play",
    in_progress: "is playing",
    finished: "finished",
    dropped: "dropped",
  },
  book: {
    want: "wants to read",
    in_progress: "is reading",
    finished: "finished",
    dropped: "dropped",
  },
};

/** A status as something a person did, ready for a title to follow: "is reading", "watched". */
export function activityPhrase(status: LibraryStatus, type: MediaType): string {
  return ACTIVITY[type][status];
}

export function libraryPath(type?: MediaType, status?: LibraryStatus): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  return params.size > 0 ? `/library?${params}` : "/library";
}

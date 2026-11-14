import type { RouterOutputs } from "@yousiverse/api";
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

const VERBS: Record<MediaType, { want: string; in_progress: string }> = {
  movie: { want: "Want to watch", in_progress: "Watching" },
  tv: { want: "Want to watch", in_progress: "Watching" },
  game: { want: "Want to play", in_progress: "Playing" },
  book: { want: "Want to read", in_progress: "Reading" },
};

/** A status in the words that fit one type of title: "Want to read", "Playing". */
export function statusLabel(status: LibraryStatus, type: MediaType): string {
  return status === "want" || status === "in_progress"
    ? VERBS[type][status]
    : STATUS_LABELS[status];
}

const ACTIVITY: Record<MediaType, { want: string; in_progress: string }> = {
  movie: { want: "wants to watch", in_progress: "is watching" },
  tv: { want: "wants to watch", in_progress: "is watching" },
  game: { want: "wants to play", in_progress: "is playing" },
  book: { want: "wants to read", in_progress: "is reading" },
};

/** A status as something a person did, ready for a title to follow: "is reading", "finished". */
export function activityPhrase(status: LibraryStatus, type: MediaType): string {
  if (status === "want" || status === "in_progress") return ACTIVITY[type][status];
  return status === "finished" ? "finished" : "dropped";
}

export function libraryPath(type?: MediaType, status?: LibraryStatus): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  return params.size > 0 ? `/library?${params}` : "/library";
}

import type { CSSProperties } from "react";
import { usToday } from "@/lib/days";
import type { LibraryEntry } from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { ProgressUpdate } from "./progress-update";
import { hoursOf, progressInWords } from "./progress-words";

type Props = {
  title: { mediaId: string; type: MediaType; title: string };
  entry: LibraryEntry;
};

/**
 * How far through a title the signed-in person is. A book or a game they are in the middle of
 * also gets the button that records it, since nothing else can tell the app.
 */
export function ProgressLine({ title, entry }: Props) {
  const { progress } = entry;
  const measure = title.type === "book" ? "pages" : title.type === "game" ? "hours" : null;
  const canUpdate = measure !== null && entry.status === "in_progress";
  if (!progress && !canUpdate) return null;

  const inWords = progress && progressInWords(progress, usToday());
  const recorded =
    progress?.kind === "pages"
      ? progress.read
      : progress?.kind === "minutes"
        ? hoursOf(progress.played)
        : null;
  return (
    <div className="hero__progress">
      {inWords && <span>{inWords.text}</span>}
      {inWords && inWords.value !== null && (
        <div className="bar" aria-hidden="true" style={{ "--v": inWords.value } as CSSProperties}>
          <i />
        </div>
      )}
      {canUpdate && (
        <ProgressUpdate
          mediaId={title.mediaId}
          title={title.title}
          measure={measure}
          recorded={recorded}
        />
      )}
    </div>
  );
}

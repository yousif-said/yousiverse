import type { LibraryStatus } from "@yousiverse/db/schema";
import type { getTraktHistory, TraktTitle } from "@yousiverse/integrations/trakt";
import { type ImportRow, type ParsedImport, RowCollection, toQuarterPoints } from "../rows";

type TraktHistory = Awaited<ReturnType<typeof getTraktHistory>>;

/**
 * A movie that was played is finished. A show is finished once it has been played at least as
 * many times as it has aired episodes, and in progress until then.
 */
function watchedStatus(title: TraktTitle): LibraryStatus {
  if (title.type === "movie") return "finished";
  const aired = title.airedEpisodes ?? Number.POSITIVE_INFINITY;
  return (title.plays ?? 0) >= aired ? "finished" : "in_progress";
}

/** Turns a Trakt profile's lists into import rows, one per title. */
export function traktRows(history: TraktHistory): ParsedImport {
  const collection = new RowCollection();
  const skippedTitles = new Set<string>();
  const keyOf = (title: TraktTitle) => `${title.type}:${title.traktId}`;

  const add = (title: TraktTitle, status: LibraryStatus, rating: number | null) => {
    // Trakt lists a few titles that TMDB and IMDb do not have. There is nothing to match those to.
    const externalId = title.tmdbId ?? title.imdbId;
    if (!externalId) {
      skippedTitles.add(keyOf(title));
      return;
    }
    const row: ImportRow = {
      type: title.type,
      title: title.title,
      year: title.year,
      creator: null,
      externalId,
      externalKind: title.tmdbId ? "tmdb" : "imdb",
      status,
      rating,
      review: null,
    };
    collection.add(keyOf(title), row);
  };

  const watched = new Map(history.watched.map((title) => [keyOf(title), watchedStatus(title)]));
  for (const title of history.watchlist) add(title, "want", null);
  for (const title of history.watched) add(title, watchedStatus(title), null);
  for (const title of history.rated) {
    // A rating means the person has seen it, even if it is missing from their watch history.
    // A show they are still watching stays in progress.
    const status = watched.get(keyOf(title)) ?? "finished";
    add(title, status, toQuarterPoints(String(title.rating ?? ""), 10));
  }
  return { rows: collection.toArray(), skipped: skippedTitles.size };
}

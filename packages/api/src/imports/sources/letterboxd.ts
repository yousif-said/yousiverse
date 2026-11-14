import { cell, readTable } from "../csv";
import {
  ImportFileError,
  type ParsedImport,
  RowCollection,
  toQuarterPoints,
  toReview,
  toYear,
} from "../rows";
import type { UploadedFile } from "./index";

/**
 * Letterboxd's export is a folder of files. `watched.csv`, `diary.csv`, `ratings.csv` and
 * `reviews.csv` all describe films the person has seen; `watchlist.csv` has the same columns as
 * `watched.csv` and can only be told apart by its name.
 */
export function parseLetterboxd(files: UploadedFile[]): ParsedImport {
  const collection = new RowCollection();

  // Ratings are read last so the rating file, which holds the current rating, has the last word.
  const ordered = [...files].sort(
    (a, b) => Number(/rating/i.test(a.name)) - Number(/rating/i.test(b.name)),
  );
  for (const file of ordered) {
    const { columns, records } = readTable(file.text);
    if (!columns.includes("name") || !columns.includes("year")) {
      throw new ImportFileError(
        `${file.name} does not look like a Letterboxd file: it has no Name and Year columns.`,
      );
    }
    const isWatchlist = /watchlist/i.test(file.name);

    for (const record of records) {
      const title = cell(record, "name");
      if (!title) continue;
      const year = toYear(cell(record, "year"));
      collection.add(`${title.toLowerCase()}|${year}`, {
        type: "movie",
        title,
        year,
        creator: null,
        externalId: null,
        externalKind: null,
        status: isWatchlist ? "want" : "finished",
        rating: toQuarterPoints(cell(record, "rating"), 5),
        review: toReview(cell(record, "review")),
      });
    }
  }
  return { rows: collection.toArray(), skipped: 0 };
}

import { cell, readTable } from "../csv";
import {
  ImportFileError,
  type ParsedImport,
  RowCollection,
  toQuarterPoints,
  toYear,
} from "../rows";
import type { UploadedFile } from "./index";

/**
 * IMDb exports ratings and lists (the watchlist among them) as CSV. Every row carries the
 * title's IMDb id in a `Const` column. A row with a rating is something the person has seen;
 * a row without one is something they want to see.
 */
export function parseImdb(files: UploadedFile[]): ParsedImport {
  const collection = new RowCollection();
  let skipped = 0;

  for (const file of files) {
    const { columns, records } = readTable(file.text);
    if (!columns.includes("const") || !columns.includes("title")) {
      throw new ImportFileError(
        `${file.name} does not look like an IMDb export: it has no Const and Title columns.`,
      );
    }

    for (const record of records) {
      const imdbId = cell(record, "const");
      const title = cell(record, "title");
      if (!imdbId || !title) continue;

      const kind = (cell(record, "title type") ?? "").toLowerCase();
      // Single episodes and games have no counterpart to match by IMDb id.
      if (kind.includes("episode") || kind.includes("game")) {
        skipped++;
        continue;
      }
      const rating = toQuarterPoints(cell(record, "your rating", "you rated"), 10);
      collection.add(imdbId, {
        type: kind.includes("series") ? "tv" : "movie",
        title,
        year: toYear(cell(record, "year")),
        creator: null,
        externalId: imdbId,
        externalKind: "imdb",
        status: rating === null ? "want" : "finished",
        rating,
        review: null,
      });
    }
  }
  return { rows: collection.toArray(), skipped };
}

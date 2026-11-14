import type { LibraryStatus } from "@yousiverse/db/schema";
import { type CsvRecord, cell, readTable } from "../csv";
import {
  ImportFileError,
  type ImportRow,
  type ParsedImport,
  RowCollection,
  toQuarterPoints,
  toReview,
  toYear,
} from "../rows";
import type { UploadedFile } from "./index";

/** The shelf names both services use, and Goodreads shelves people commonly add for giving up. */
const STATUS_FOR: Record<string, LibraryStatus> = {
  read: "finished",
  "currently-reading": "in_progress",
  paused: "in_progress",
  "to-read": "want",
  "did-not-finish": "dropped",
  dnf: "dropped",
  abandoned: "dropped",
};

/** Goodreads wraps ISBNs as ="0123456789" so spreadsheets keep their leading zeros. */
function toIsbn(value: string | null): string | null {
  const isbn = value?.replace(/[^0-9Xx]/g, "") ?? "";
  return isbn.length === 10 || isbn.length === 13 ? isbn : null;
}

/** "Dune (Dune Chronicles, #1)" → "Dune". Goodreads appends the series to the title. */
function withoutSeries(title: string): string {
  return title.replace(/\s*\([^()]*#[^()]*\)\s*$/, "").trim() || title;
}

/** Both services export reviews as HTML. */
function plainText(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

type BookColumns = {
  service: string;
  /** Columns that must be there for a file to be this service's export. */
  required: [string, string];
  shelf: string;
  author: string[];
  isbn: string[];
  rating: string;
  review: string;
  year: string[];
  /** A column that names the book within the export, if there is one. */
  id?: string;
  cleanTitle: (title: string) => string;
};

function parseBooks(files: UploadedFile[], columns: BookColumns): ParsedImport {
  const collection = new RowCollection();
  let skipped = 0;

  for (const file of files) {
    const table = readTable(file.text);
    if (!columns.required.every((column) => table.columns.includes(column))) {
      throw new ImportFileError(
        `${file.name} does not look like a ${columns.service} export: it is missing some of that export's columns.`,
      );
    }

    for (const record of table.records) {
      const row = toRow(record, columns);
      if (!row) continue;
      // A book on a shelf of the person's own, with no rating, says nothing we can store.
      if (!row.status && row.rating === null) {
        skipped++;
        continue;
      }
      const key = (columns.id && cell(record, columns.id)) || `${row.title}|${row.creator}`;
      collection.add(key.toLowerCase(), row);
    }
  }
  return { rows: collection.toArray(), skipped };
}

function toRow(record: CsvRecord, columns: BookColumns): ImportRow | null {
  const rawTitle = cell(record, "title");
  if (!rawTitle) return null;
  const isbn = columns.isbn.map((column) => toIsbn(cell(record, column))).find(Boolean) ?? null;
  const rating = toQuarterPoints(cell(record, columns.rating), 5);
  const shelf = (cell(record, columns.shelf) ?? "").toLowerCase();

  return {
    type: "book",
    title: columns.cleanTitle(rawTitle),
    year: columns.year.map((column) => toYear(cell(record, column))).find(Boolean) ?? null,
    // The first author is enough to tell books with the same title apart.
    creator:
      cell(record, ...columns.author)
        ?.split(",")[0]
        ?.trim() || null,
    externalId: isbn,
    externalKind: isbn ? "isbn" : null,
    // A rated book on an unrecognized shelf has still been read.
    status: STATUS_FOR[shelf] ?? (rating === null ? null : "finished"),
    rating,
    review: toReview(plainText(cell(record, columns.review))),
  };
}

export function parseGoodreads(files: UploadedFile[]): ParsedImport {
  return parseBooks(files, {
    service: "Goodreads",
    required: ["title", "exclusive shelf"],
    shelf: "exclusive shelf",
    author: ["author"],
    isbn: ["isbn13", "isbn"],
    rating: "my rating",
    review: "my review",
    year: ["original publication year", "year published"],
    id: "book id",
    cleanTitle: withoutSeries,
  });
}

export function parseStoryGraph(files: UploadedFile[]): ParsedImport {
  return parseBooks(files, {
    service: "StoryGraph",
    required: ["title", "read status"],
    shelf: "read status",
    author: ["authors"],
    isbn: ["isbn/uid"],
    rating: "star rating",
    review: "review",
    year: [],
    cleanTitle: (title) => title,
  });
}

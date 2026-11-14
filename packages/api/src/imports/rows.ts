import {
  type ExternalIdKind,
  type LibraryStatus,
  MAX_RATING,
  type MediaType,
} from "@yousiverse/db/schema";

/** One title read from an uploaded file, before it is matched to the catalog. */
export type ImportRow = {
  type: MediaType;
  title: string;
  year: number | null;
  creator: string | null;
  externalId: string | null;
  externalKind: ExternalIdKind | null;
  status: LibraryStatus | null;
  /** Quarter points, 0 to 40. */
  rating: number | null;
  review: string | null;
};

export type ParsedImport = {
  rows: ImportRow[];
  /** Rows left out because the app has no place for them, such as single TV episodes. */
  skipped: number;
};

/** A problem with an uploaded file that its owner can fix. The message is shown to them. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

const MAX_REVIEW_LENGTH = 10_000;

/** Converts a rating on another service's scale to quarter points. Null for "not rated". */
export function toQuarterPoints(value: string | null, scaleMax: 5 | 10): number | null {
  const rating = Number(value);
  if (!value || !Number.isFinite(rating) || rating <= 0 || rating > scaleMax) return null;
  return Math.round((rating / scaleMax) * MAX_RATING);
}

export function toYear(value: string | null): number | null {
  const year = Number(value);
  return value && Number.isInteger(year) && year > 1000 && year < 3000 ? year : null;
}

export function toReview(value: string | null): string | null {
  const review = value?.trim().slice(0, MAX_REVIEW_LENGTH);
  return review || null;
}

const STATUS_RANK: Record<LibraryStatus, number> = {
  want: 0,
  dropped: 1,
  in_progress: 2,
  finished: 3,
};

/**
 * Combines two rows about the same title, as when one file lists a film as watched and another
 * holds its rating. The row read later wins, except that a status never moves backwards.
 */
export function mergeRows(earlier: ImportRow, later: ImportRow): ImportRow {
  const status =
    earlier.status && later.status
      ? STATUS_RANK[later.status] >= STATUS_RANK[earlier.status]
        ? later.status
        : earlier.status
      : (later.status ?? earlier.status);
  return {
    ...earlier,
    year: later.year ?? earlier.year,
    creator: later.creator ?? earlier.creator,
    externalId: later.externalId ?? earlier.externalId,
    externalKind: later.externalKind ?? earlier.externalKind,
    status,
    rating: later.rating ?? earlier.rating,
    review: later.review ?? earlier.review,
  };
}

/** Collects rows by a key naming the title, merging rows that share one. */
export class RowCollection {
  private readonly rows = new Map<string, ImportRow>();

  add(key: string, row: ImportRow) {
    const existing = this.rows.get(key);
    this.rows.set(key, existing ? mergeRows(existing, row) : row);
  }

  toArray(): ImportRow[] {
    return [...this.rows.values()];
  }
}

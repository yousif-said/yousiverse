import { describe, expect, it } from "vitest";
import { IMPORT_SOURCES, isFileSource, PROFILE_FIELDS, unmatchedCount } from "./imports";

describe("import sources", () => {
  it("reads a service from files unless it is read from a profile", () => {
    expect(IMPORT_SOURCES.filter(isFileSource)).toEqual([
      "letterboxd",
      "imdb",
      "goodreads",
      "storygraph",
    ]);
    expect(IMPORT_SOURCES.filter((source) => !isFileSource(source))).toEqual(
      Object.keys(PROFILE_FIELDS),
    );
  });
});

describe("unmatchedCount", () => {
  it("counts a title that failed with the ones that were not found", () => {
    const progress = { pending: 0, imported: 5, already: 2, not_found: 3, failed: 1, total: 11 };

    expect(unmatchedCount(progress)).toBe(4);
  });
});

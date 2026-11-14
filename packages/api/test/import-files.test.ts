import { describe, expect, it } from "vitest";
import { parseCsv, readTable } from "../src/imports/csv";
import { ImportFileError, toQuarterPoints } from "../src/imports/rows";
import { parseImdb } from "../src/imports/sources/imdb";
import { parseLetterboxd } from "../src/imports/sources/letterboxd";

describe("parseCsv", () => {
  it("reads quoted fields holding commas, quotes, and line breaks", () => {
    const text = 'Name,Review\r\n"Hello, World","She said ""hi""\nand left"\nPlain,\n';

    expect(parseCsv(text)).toEqual([
      ["Name", "Review"],
      ["Hello, World", 'She said "hi"\nand left'],
      ["Plain", ""],
    ]);
  });

  it("skips blank lines and reads a last line with no line break", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("readTable", () => {
  it("lowercases column names and ignores a byte order mark", () => {
    expect(readTable("﻿Name, Year \nDune,1984\n")).toEqual({
      columns: ["name", "year"],
      records: [{ name: "Dune", year: "1984" }],
    });
  });
});

describe("toQuarterPoints", () => {
  it("converts five-star and ten-point ratings", () => {
    expect(toQuarterPoints("5", 5)).toBe(40);
    expect(toQuarterPoints("3.5", 5)).toBe(28);
    expect(toQuarterPoints("0.5", 5)).toBe(4);
    expect(toQuarterPoints("4.25", 5)).toBe(34);
    expect(toQuarterPoints("7", 10)).toBe(28);
  });

  it("treats zero, blanks, and nonsense as not rated", () => {
    expect(toQuarterPoints("0", 5)).toBeNull();
    expect(toQuarterPoints("", 5)).toBeNull();
    expect(toQuarterPoints(null, 10)).toBeNull();
    expect(toQuarterPoints("eleven", 10)).toBeNull();
    expect(toQuarterPoints("11", 10)).toBeNull();
  });
});

const WATCHED = `Date,Name,Year,Letterboxd URI
2024-01-05,The Matrix,1999,https://boxd.it/2a1m
2024-01-06,Heat,1995,https://boxd.it/2bfQ
`;
const RATINGS = `Date,Name,Year,Letterboxd URI,Rating
2024-01-05,The Matrix,1999,https://boxd.it/2a1m,4.5
`;
const REVIEWS = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2024-01-05,The Matrix,1999,https://boxd.it/abc,4,,"Whoa.
Still holds up.",,2024-01-04
`;
const WATCHLIST = `Date,Name,Year,Letterboxd URI
2024-02-01,Dune,2021,https://boxd.it/nJ5O
2024-02-02,Heat,1995,https://boxd.it/2bfQ
`;

describe("parseLetterboxd", () => {
  it("merges a film's rows from every file into one title", () => {
    const { rows, skipped } = parseLetterboxd([
      { name: "ratings.csv", text: RATINGS },
      { name: "watched.csv", text: WATCHED },
      { name: "reviews.csv", text: REVIEWS },
      { name: "watchlist.csv", text: WATCHLIST },
    ]);

    expect(skipped).toBe(0);
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({
      type: "movie",
      title: "The Matrix",
      year: 1999,
      creator: null,
      externalId: null,
      externalKind: null,
      status: "finished",
      // The ratings file has the last word over the rating on an old review.
      rating: 36,
      review: "Whoa.\nStill holds up.",
    });
    // Watched and on the watchlist: watched wins.
    expect(rows).toContainEqual(expect.objectContaining({ title: "Heat", status: "finished" }));
    expect(rows).toContainEqual(
      expect.objectContaining({ title: "Dune", status: "want", rating: null, review: null }),
    );
  });

  it("refuses a file without the Letterboxd columns, naming the file", () => {
    const wrong = [{ name: "notes.csv", text: "Title,Stars\nDune,5\n" }];

    expect(() => parseLetterboxd(wrong)).toThrow(ImportFileError);
    expect(() => parseLetterboxd(wrong)).toThrow(/notes\.csv/);
  });
});

const IMDB_RATINGS = `Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
tt0133093,9,2024-01-05,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093,Movie,8.7,136,1999,"Action, Sci-Fi",2000000,1999-03-31,"Lana Wachowski, Lilly Wachowski"
tt11280740,10,2024-01-06,Severance,Severance,https://www.imdb.com/title/tt11280740,TV Series,8.7,,2022,Drama,300000,2022-02-18,
tt13399862,8,2024-01-07,Good News About Hell,Good News About Hell,https://www.imdb.com/title/tt13399862,TV Episode,8.3,57,2022,Drama,9000,2022-02-18,
tt1458229,7,2024-01-08,Hades,Hades,https://www.imdb.com/title/tt1458229,Video Game,9.2,,2018,Action,5000,2018-12-06,
`;
const IMDB_WATCHLIST = `Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt0113277,2024-02-01,2024-02-01,,Heat,Heat,https://www.imdb.com/title/tt0113277,Movie,8.3,170,1995,Crime,700000,1995-12-15,Michael Mann,,
2,tt0133093,2024-02-01,2024-02-01,,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093,Movie,8.7,136,1999,Action,2000000,1999-03-31,,9,2024-01-05
`;

describe("parseImdb", () => {
  it("reads rated titles as finished and unrated ones as wanted, skipping episodes and games", () => {
    const { rows, skipped } = parseImdb([
      { name: "ratings.csv", text: IMDB_RATINGS },
      { name: "watchlist.csv", text: IMDB_WATCHLIST },
    ]);

    expect(skipped).toBe(2);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "movie",
        title: "The Matrix",
        year: 1999,
        externalId: "tt0133093",
        externalKind: "imdb",
        status: "finished",
        rating: 36,
      }),
      expect.objectContaining({ type: "tv", title: "Severance", status: "finished", rating: 40 }),
      expect.objectContaining({ type: "movie", title: "Heat", status: "want", rating: null }),
    ]);
  });

  it("refuses a file without the IMDb columns", () => {
    expect(() => parseImdb([{ name: "films.csv", text: WATCHED }])).toThrow(ImportFileError);
  });
});

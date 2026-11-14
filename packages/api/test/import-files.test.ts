import { describe, expect, it } from "vitest";
import { parseCsv, readTable } from "../src/imports/csv";
import { ImportFileError, toQuarterPoints } from "../src/imports/rows";
import { parseGoodreads, parseStoryGraph } from "../src/imports/sources/books";
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

const GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
1,"Dune (Dune Chronicles, #1)",Frank Herbert,"Herbert, Frank",,"=""0441172717""","=""9780441172719""",5,4.2,Ace,Paperback,604,1990,1965,2023/05/01,2023/04/01,,,read,"Sand, worms.<br/>Loved it &amp; more.",,,1,0
2,Piranesi,Susanna Clarke,"Clarke, Susanna",,"=""""","=""9781635575637""",0,4.2,Bloomsbury,Hardcover,272,2020,2020,,2024/01/01,,,to-read,,,,0,0
3,Half Read,Some Author,"Author, Some",,"=""""","=""""",0,3.0,,,100,2001,,,2024/01/02,,,currently-reading,,,,0,0
4,Gave Up,Some Author,"Author, Some",,"=""""","=""""",0,3.0,,,100,2001,,,2024/01/02,dnf,dnf (#1),dnf,,,,0,0
5,On My Own Shelf,Some Author,"Author, Some",,"=""""","=""""",0,3.0,,,100,2001,,,2024/01/02,owned,owned (#1),owned,,,,0,0
6,Rated On My Own Shelf,Some Author,"Author, Some",,"=""""","=""""",3,3.0,,,100,2001,,,2024/01/02,favorites,favorites (#1),favorites,,,,1,0
`;

describe("parseGoodreads", () => {
  it("reads shelves as statuses, cleans titles and ISBNs, and turns review HTML into text", () => {
    const { rows, skipped } = parseGoodreads([{ name: "goodreads.csv", text: GOODREADS }]);

    expect(skipped).toBe(1);
    expect(rows).toEqual([
      {
        type: "book",
        title: "Dune",
        year: 1965,
        creator: "Frank Herbert",
        externalId: "9780441172719",
        externalKind: "isbn",
        status: "finished",
        rating: 40,
        review: "Sand, worms.\nLoved it & more.",
      },
      expect.objectContaining({
        title: "Piranesi",
        externalId: "9781635575637",
        status: "want",
        rating: null,
        review: null,
      }),
      expect.objectContaining({ title: "Half Read", status: "in_progress", externalId: null }),
      expect.objectContaining({ title: "Gave Up", status: "dropped" }),
      expect.objectContaining({ title: "Rated On My Own Shelf", status: "finished", rating: 24 }),
    ]);
  });

  it("refuses a file without the Goodreads columns", () => {
    expect(() => parseGoodreads([{ name: "watched.csv", text: WATCHED }])).toThrow(
      /watched\.csv does not look like a Goodreads export/,
    );
  });
});

const STORYGRAPH = `Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?
Piranesi,Susanna Clarke,,9781635575637,hardcover,read,2024/01/01,2024/01/10,2024/01/10,1,mysterious,slow,Character,Yes,Yes,,,4.25,<div>The House is kind.</div>,,,,No
Dune,"Frank Herbert, Someone Else",,B000ABC123,digital,did-not-finish,2024/01/02,,,0,,,,,,,,,,,,,No
Later,Some Author,,,paperback,to-read,2024/01/03,,,0,,,,,,,,,,,,,No
`;

describe("parseStoryGraph", () => {
  it("reads statuses, quarter-star ratings, and only real ISBNs", () => {
    const { rows, skipped } = parseStoryGraph([{ name: "storygraph.csv", text: STORYGRAPH }]);

    expect(skipped).toBe(0);
    expect(rows).toEqual([
      {
        type: "book",
        title: "Piranesi",
        year: null,
        creator: "Susanna Clarke",
        externalId: "9781635575637",
        externalKind: "isbn",
        status: "finished",
        rating: 34,
        review: "The House is kind.",
      },
      expect.objectContaining({
        title: "Dune",
        creator: "Frank Herbert",
        externalId: null,
        externalKind: null,
        status: "dropped",
      }),
      expect.objectContaining({ title: "Later", status: "want" }),
    ]);
  });

  it("refuses a file without the StoryGraph columns", () => {
    expect(() => parseStoryGraph([{ name: "goodreads.csv", text: GOODREADS }])).toThrow(
      ImportFileError,
    );
  });
});

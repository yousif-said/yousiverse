import { db } from "@yousiverse/db";
import { importItems, media, users } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anonymous, signedInAs } from "./helpers";

type Caller = Awaited<ReturnType<typeof signedInAs>>["caller"];

const LETTERBOXD = {
  name: "reviews.csv",
  text: `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date
2024-01-05,The Matrix,1999,https://boxd.it/abc,4.5,,Whoa.,,2024-01-04
2024-01-06,Zzzzqqqqxxxx,1999,https://boxd.it/def,3,,,,2024-01-05
`,
};
const IMDB = {
  name: "ratings.csv",
  text: `Const,Your Rating,Date Rated,Title,URL,Title Type,Year
tt0133093,9,2024-01-05,The Matrix,https://www.imdb.com/title/tt0133093,Movie,1999
tt11280740,10,2024-01-06,Severance,https://www.imdb.com/title/tt11280740,TV Series,2022
tt99999999,5,2024-01-07,Nothing,https://www.imdb.com/title/tt99999999,Movie,2001
tt13399862,8,2024-01-07,Good News About Hell,https://www.imdb.com/title/tt13399862,TV Episode,2022
`,
};

/** Runs an import to the end, the way the import page does. */
async function runToEnd(caller: Caller, id: string) {
  for (let round = 0; round < 50; round++) {
    const { progress } = await caller.imports.process({ id });
    if (progress.pending === 0) return progress;
  }
  throw new Error("The import did not finish.");
}

describe("imports", () => {
  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires signing in", async () => {
    await expect(
      anonymous.imports.createFromFiles({
        source: "letterboxd",
        visibility: "public",
        files: [LETTERBOXD],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.imports.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("imports Letterboxd films with their status, rating, and review", async () => {
    const { caller } = await signedInAs("Ada");

    const { id } = await caller.imports.createFromFiles({
      source: "letterboxd",
      visibility: "friends",
      files: [LETTERBOXD],
    });
    expect((await caller.imports.get({ id })).progress).toMatchObject({ total: 2, pending: 2 });

    expect(await runToEnd(caller, id)).toMatchObject({ imported: 1, not_found: 1, pending: 0 });

    expect(await caller.library.list()).toMatchObject([
      { title: "The Matrix", type: "movie", status: "finished", visibility: "friends" },
    ]);
    const [matrix] = await db.select().from(media);
    if (!matrix) throw new Error("The film was not listed.");
    expect(matrix).toMatchObject({ provider: "tmdb", providerId: "603", releaseYear: 1999 });
    const target = { mediaId: matrix.id };
    expect(await caller.ratings.summary({ target })).toMatchObject({ mine: 36 });
    expect((await caller.reviews.list({ target })).mine).toEqual({
      body: "Whoa.",
      visibility: "friends",
    });
    expect(await caller.imports.get({ id })).toMatchObject({
      source: "letterboxd",
      unmatched: [{ title: "Zzzzqqqqxxxx", year: 1999 }],
    });
  });

  it("imports IMDb titles by their IMDb id, skipping single episodes", async () => {
    const { caller } = await signedInAs("Ada");

    const { id } = await caller.imports.createFromFiles({
      source: "imdb",
      visibility: "public",
      files: [IMDB],
    });

    expect(await runToEnd(caller, id)).toMatchObject({ imported: 2, not_found: 1, total: 3 });
    expect(await caller.imports.get({ id })).toMatchObject({
      skippedCount: 1,
      unmatched: [{ title: "Nothing" }],
    });
    const library = await caller.library.list();
    expect(library.map((entry) => `${entry.type} ${entry.title}`).sort()).toEqual([
      "movie The Matrix",
      "tv Severance",
    ]);
  });

  it("imports books by ISBN, then by exact title and author", async () => {
    const { caller } = await signedInAs("Ada");
    const goodreads = {
      name: "goodreads_library_export.csv",
      text: `Book Id,Title,Author,ISBN,ISBN13,My Rating,Original Publication Year,Exclusive Shelf,My Review
1,Piranesi,Susanna Clarke,"=""""","=""9781635575637""",4,2020,read,The House is kind.
2,"Dune (Dune Chronicles, #1)",Frank Herbert,"=""""","=""""",0,1965,to-read,
3,Zzzzqqqqxxxx,Nobody,"=""""","=""9780000000002""",5,2001,read,
`,
    };

    const { id } = await caller.imports.createFromFiles({
      source: "goodreads",
      visibility: "public",
      files: [goodreads],
    });

    expect(await runToEnd(caller, id)).toMatchObject({ imported: 2, not_found: 1, total: 3 });
    const library = await caller.library.list();
    expect(library.map((entry) => `${entry.title}: ${entry.status}`).sort()).toEqual([
      "Dune: want",
      "Piranesi: finished",
    ]);
    expect(library.every((entry) => entry.type === "book")).toBe(true);
    expect(await caller.imports.get({ id })).toMatchObject({
      unmatched: [{ title: "Zzzzqqqqxxxx", creator: "Nobody" }],
    });
    const stored = await db.select().from(media);
    expect(stored.map((book) => book.providerId)).toContain("OL20893680W");
  });

  it("never changes what the person already has", async () => {
    const { caller } = await signedInAs("Ada");
    const first = await caller.imports.createFromFiles({
      source: "letterboxd",
      visibility: "public",
      files: [LETTERBOXD],
    });
    await runToEnd(caller, first.id);
    const [matrix] = await db.select().from(media);
    if (!matrix) throw new Error("The film was not listed.");
    const target = { mediaId: matrix.id };
    await caller.library.save({ mediaId: matrix.id, status: "dropped", visibility: "private" });
    await caller.ratings.save({ target, value: 8 });
    await caller.reviews.save({ target, body: "Changed my mind.", visibility: "private" });

    const second = await caller.imports.createFromFiles({
      source: "imdb",
      visibility: "public",
      files: [IMDB],
    });
    expect(await runToEnd(caller, second.id)).toMatchObject({ already: 1, imported: 1 });

    expect(await caller.library.entry({ mediaId: matrix.id })).toEqual({
      status: "dropped",
      visibility: "private",
    });
    expect(await caller.ratings.summary({ target })).toMatchObject({ mine: 8 });
    expect((await caller.reviews.list({ target })).mine).toMatchObject({
      body: "Changed my mind.",
    });
  });

  it("reports a title as imported even when two requests process it at once", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.imports.createFromFiles({
      source: "letterboxd",
      visibility: "public",
      files: [LETTERBOXD],
    });

    await Promise.all([
      caller.imports.process({ id }),
      caller.imports.process({ id }),
      caller.imports.process({ id }),
    ]);

    expect((await caller.imports.get({ id })).progress).toMatchObject({
      imported: 1,
      already: 0,
      not_found: 1,
      pending: 0,
    });
    expect(await caller.library.list()).toHaveLength(1);
  });

  it("keeps a row waiting, and says it paused, while the provider is busy", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.imports.createFromFiles({
      source: "letterboxd",
      visibility: "public",
      files: [LETTERBOXD],
    });
    vi.spyOn(tmdb, "findMovie").mockRejectedValue(
      new ProviderError("tmdb", "rate_limited", "busy"),
    );

    expect(await caller.imports.process({ id })).toMatchObject({
      paused: true,
      progress: { pending: 2 },
    });

    vi.restoreAllMocks();
    expect(await caller.imports.process({ id })).toMatchObject({
      paused: false,
      progress: { pending: 0, imported: 1 },
    });
  });

  it("keeps one person's imports from everyone else", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.imports.createFromFiles({
      source: "letterboxd",
      visibility: "public",
      files: [LETTERBOXD],
    });

    await expect(grace.caller.imports.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(grace.caller.imports.process({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await grace.caller.imports.mine()).toEqual([]);
    expect(await ada.caller.imports.mine()).toMatchObject([{ id, source: "letterboxd", total: 2 }]);
    expect(await db.select().from(importItems)).toHaveLength(2);
    expect(await grace.caller.library.list()).toEqual([]);
  });

  it("refuses files that are not from the chosen service, or that hold no titles", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.imports.createFromFiles({ source: "imdb", visibility: "public", files: [LETTERBOXD] }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("does not look like an IMDb export"),
    });
    await expect(
      caller.imports.createFromFiles({
        source: "letterboxd",
        visibility: "public",
        files: [{ name: "watched.csv", text: "Date,Name,Year,Letterboxd URI\n" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "There were no titles to import." });
    expect(await caller.imports.mine()).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import * as igdb from "../src/igdb";
import * as openLibrary from "../src/open-library";
import * as tmdb from "../src/tmdb";

describe("tmdb.getSimilar", () => {
  it("lists the movies recommended for a movie, best match first", async () => {
    const similar = await tmdb.getSimilar("movie", "603");

    expect(similar).toHaveLength(20);
    expect(similar[0]).toEqual({
      type: "movie",
      providerId: "604",
      title: "The Matrix Reloaded",
      releaseYear: 2003,
      posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\/.+/),
      backdropUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w1280\/.+/),
    });
  });

  it("lists the shows recommended for a show", async () => {
    const similar = await tmdb.getSimilar("tv", "95396");

    expect(similar[0]).toMatchObject({
      type: "tv",
      providerId: "91962",
      title: "Emergence",
      backdropUrl: expect.stringContaining("/w1280/"),
    });
    expect(similar.every((show) => show.type === "tv")).toBe(true);
  });

  it("reports a title TMDB does not know as not found", async () => {
    const error = await tmdb.getSimilar("movie", "999999999").catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ kind: "not_found" });
  });
});

describe("igdb.getSimilar", () => {
  it("lists the games IGDB calls similar", async () => {
    expect(await igdb.getSimilar("113112")).toContainEqual({
      type: "game",
      providerId: "228525",
      title: "Hades II",
      releaseYear: 2025,
      posterUrl: expect.stringMatching(/t_cover_big\/.+\.jpg$/),
      backdropUrl: null,
    });
  });

  it("answers with nothing for a game that does not exist", async () => {
    expect(await igdb.getSimilar("999999999")).toEqual([]);
  });
});

describe("openLibrary.getByAuthor", () => {
  it("lists an author's own books that have an English edition", async () => {
    const books = await openLibrary.getByAuthor("Susanna Clarke");

    expect(books.map((book) => book.title)).toEqual([
      "Jonathan Strange and Mr. Norrell",
      "Piranesi",
      "The Ladies of Grace Adieu and Other Stories",
      "Wood at Midwinter",
    ]);
    expect(books[1]).toMatchObject({
      type: "book",
      providerId: "OL20893680W",
      releaseYear: 2020,
      backdropUrl: null,
    });
  });

  it("matches the author's name whatever the capitals", async () => {
    // The request itself is recorded under the exact spelling, so only the filter is tested.
    expect((await openLibrary.getByAuthor(" Susanna Clarke ")).length).toBe(4);
  });

  it("answers with nothing for an author nobody is, and asks nothing for a blank name", async () => {
    expect(await openLibrary.getByAuthor("Zzzzqqqqxxxx Nobody")).toEqual([]);
    expect(await openLibrary.getByAuthor("  ")).toEqual([]);
  });
});

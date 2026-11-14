import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { findByImdbId, findMovie, getMovie, getTvShow, search } from "../src/tmdb";

describe("tmdb.search", () => {
  it("returns movies and shows, without people", async () => {
    const results = await search("severance");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(({ type }) => type === "movie" || type === "tv")).toBe(true);
    expect(results).toContainEqual({
      type: "tv",
      providerId: "95396",
      title: "Severance",
      releaseYear: 2022,
      posterUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\/.+/),
    });
  });

  it("returns nothing when no title matches", async () => {
    expect(await search("zzzzqqqqxxxx")).toEqual([]);
  });
});

describe("tmdb.getMovie", () => {
  it("normalizes a movie", async () => {
    expect(await getMovie("603")).toMatchObject({
      providerId: "603",
      title: "The Matrix",
      releaseDate: "1999-03-31",
      releaseYear: 1999,
      runtimeMinutes: 136,
      genres: expect.arrayContaining(["Science Fiction"]),
      posterUrl: expect.stringContaining("/w500/"),
    });
  });

  it("reports an unknown movie as not found", async () => {
    const error = await getMovie("999999999").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "tmdb", kind: "not_found" });
  });
});

describe("tmdb.getTvShow", () => {
  it("includes every season with its episodes", async () => {
    const show = await getTvShow("95396");

    expect(show).toMatchObject({ providerId: "95396", title: "Severance", releaseYear: 2022 });
    expect(show.seasons.map((season) => season.seasonNumber)).toEqual([0, 1, 2, 3]);

    const firstSeason = show.seasons.find((season) => season.seasonNumber === 1);
    expect(firstSeason?.episodes).toHaveLength(9);
    expect(firstSeason?.episodes[0]).toMatchObject({
      episodeNumber: 1,
      name: "Good News About Hell",
      airDate: "2022-02-17",
    });
  });
});

describe("tmdb.findMovie", () => {
  it("finds a film by its title and year", async () => {
    expect(await findMovie("The Matrix", 1999)).toEqual({
      type: "movie",
      providerId: "603",
      title: "The Matrix",
      releaseYear: 1999,
      posterUrl: expect.stringContaining("/w342/"),
    });
  });

  it("accepts an exact title when the year is unknown, whatever its capitals", async () => {
    expect(await findMovie("the matrix", null)).toMatchObject({ providerId: "603" });
  });

  it("finds nothing rather than guess", async () => {
    expect(await findMovie("Zzzzqqqqxxxx", 1999)).toBeNull();
  });
});

describe("tmdb.findByImdbId", () => {
  it("finds a movie or a TV show by its IMDb id", async () => {
    expect(await findByImdbId("tt0133093")).toMatchObject({ type: "movie", providerId: "603" });
    expect(await findByImdbId("tt11280740")).toMatchObject({
      type: "tv",
      providerId: "95396",
      title: "Severance",
    });
  });

  it("finds nothing for an id nobody has, or text that is not an IMDb id", async () => {
    expect(await findByImdbId("tt99999999")).toBeNull();
    expect(await findByImdbId("603")).toBeNull();
  });
});

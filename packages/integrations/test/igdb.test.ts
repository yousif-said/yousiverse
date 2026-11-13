import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { getGame, search } from "../src/igdb";
import { gameQuery, searchQuery } from "../src/igdb/queries";

describe("igdb.search", () => {
  it("returns games", async () => {
    expect(await search("hades")).toContainEqual({
      type: "game",
      providerId: "113112",
      title: "Hades",
      releaseYear: 2020,
      posterUrl: expect.stringMatching(/^https:\/\/images\.igdb\.com\/.+\/t_cover_big\/.+\.jpg$/),
    });
  });

  it("returns nothing when no title matches", async () => {
    expect(await search("zzzzqqqqxxxx")).toEqual([]);
  });
});

describe("igdb.getGame", () => {
  it("normalizes a game", async () => {
    expect(await getGame("113112")).toMatchObject({
      providerId: "113112",
      title: "Hades",
      releaseDate: "2020-09-17",
      releaseYear: 2020,
      developers: ["Supergiant Games"],
      publishers: expect.arrayContaining(["Supergiant Games"]),
      platforms: expect.arrayContaining(["Nintendo Switch"]),
      genres: expect.arrayContaining(["Indie"]),
      steamAppId: "1145360",
    });
  });

  it("reports an unknown game as not found", async () => {
    const error = await getGame("999999999").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "igdb", kind: "not_found" });
  });
});

describe("igdb queries", () => {
  it("escapes quotes and backslashes so a search cannot change the query", () => {
    expect(searchQuery('a"; fields *; \\')).toContain('search "a\\"; fields *; \\\\";');
  });

  it("refuses an id that is not a number", () => {
    expect(() => gameQuery("1; fields *")).toThrow();
  });
});

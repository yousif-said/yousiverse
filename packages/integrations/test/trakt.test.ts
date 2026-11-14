import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { getTraktHistory, getTraktProfile, traktUsername } from "../src/trakt";

describe("traktUsername", () => {
  it("reads a username from an address or by itself", () => {
    expect(traktUsername("https://trakt.tv/users/Sean/")).toBe("sean");
    expect(traktUsername("trakt.tv/users/sean/history")).toBe("sean");
    expect(traktUsername(" @sean ")).toBe("sean");
    expect(traktUsername("first.last-2")).toBe("first.last-2");
  });

  it("refuses text that cannot be a username", () => {
    expect(traktUsername("two words")).toBeNull();
    expect(traktUsername("")).toBeNull();
    expect(traktUsername("a/b")).toBeNull();
  });
});

describe("getTraktProfile", () => {
  it("says whether a profile is private", async () => {
    expect(await getTraktProfile("fixturewatcher")).toEqual({ private: false });
    expect(await getTraktProfile("privatewatcher")).toEqual({ private: true });
  });

  it("reports an unknown username as not found", async () => {
    const error = await getTraktProfile("nobody-has-this").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "trakt", kind: "not_found" });
  });
});

describe("getTraktHistory", () => {
  it("reads every page of the watch history, ratings, and watchlist", async () => {
    const history = await getTraktHistory("fixturewatcher");

    expect(history.watched).toEqual([
      expect.objectContaining({ type: "movie", title: "The Matrix", tmdbId: "603", plays: 2 }),
      expect.objectContaining({
        type: "tv",
        title: "Severance",
        tmdbId: "95396",
        plays: 5,
        airedEpisodes: 19,
      }),
    ]);
    expect(history.rated).toEqual([
      expect.objectContaining({ title: "The Matrix", rating: 9, plays: null }),
    ]);
    expect(history.watchlist.map((title) => title.tmdbId)).toEqual(["999999999", null]);
  });
});

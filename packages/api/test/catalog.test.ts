import { db } from "@yousiverse/db";
import { episodes, media, seasons } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../src/root";

const caller = appRouter.createCaller({ db, session: null });

const MATRIX = "603";
const SEVERANCE = "95396";
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await db.delete(media);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("catalog.search", () => {
  it("returns matching movies and shows", async () => {
    const { results, unavailable } = await caller.catalog.search({ query: "severance" });

    expect(unavailable).toEqual([]);
    expect(results).toContainEqual(
      expect.objectContaining({ type: "tv", providerId: SEVERANCE, title: "Severance" }),
    );
  });

  it("lists the media types of a provider that failed instead of failing the search", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(tmdb, "search").mockRejectedValue(new ProviderError("tmdb", "unavailable", "down"));

    expect(await caller.catalog.search({ query: "severance" })).toEqual({
      results: [],
      unavailable: ["movie", "tv"],
    });
  });

  it("rejects a blank query", async () => {
    await expect(caller.catalog.search({ query: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("media.movie", () => {
  it("imports a movie the first time it is opened and stores it", async () => {
    const movie = await caller.media.movie({ providerId: MATRIX });

    expect(movie).toMatchObject({ title: "The Matrix", releaseYear: 1999, runtimeMinutes: 136 });
    const stored = await db.select().from(media);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: "movie", provider: "tmdb", providerId: MATRIX });
  });

  it("serves the stored copy without asking the provider again", async () => {
    await caller.media.movie({ providerId: MATRIX });
    const getMovie = vi.spyOn(tmdb, "getMovie");

    await caller.media.movie({ providerId: MATRIX });

    expect(getMovie).not.toHaveBeenCalled();
    expect(await db.$count(media)).toBe(1);
  });

  it("refreshes a stored copy older than a week", async () => {
    await caller.media.movie({ providerId: MATRIX });
    await db
      .update(media)
      .set({ title: "Old title", syncedAt: new Date(Date.now() - EIGHT_DAYS_MS) });

    expect(await caller.media.movie({ providerId: MATRIX })).toMatchObject({
      title: "The Matrix",
    });
  });

  it("serves an out-of-date copy when the provider is down", async () => {
    await caller.media.movie({ providerId: MATRIX });
    await db.update(media).set({ syncedAt: new Date(Date.now() - EIGHT_DAYS_MS) });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(tmdb, "getMovie").mockRejectedValue(new ProviderError("tmdb", "unavailable", "down"));

    expect(await caller.media.movie({ providerId: MATRIX })).toMatchObject({
      title: "The Matrix",
    });
  });

  it("answers NOT_FOUND for a movie the provider does not have", async () => {
    await expect(caller.media.movie({ providerId: "999999999" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await db.$count(media)).toBe(0);
  });

  it("answers SERVICE_UNAVAILABLE when the provider is down and nothing is stored", async () => {
    vi.spyOn(tmdb, "getMovie").mockRejectedValue(new ProviderError("tmdb", "unavailable", "down"));

    await expect(caller.media.movie({ providerId: MATRIX })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("rejects an id that is not a provider id", async () => {
    await expect(caller.media.movie({ providerId: "../tv/1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("media.tvShow and media.season", () => {
  it("imports a show with its seasons and episodes", async () => {
    const show = await caller.media.tvShow({ providerId: SEVERANCE });

    expect(show).toMatchObject({ title: "Severance", releaseYear: 2022 });
    expect(
      show.seasons.map(({ seasonNumber, episodeCount }) => [seasonNumber, episodeCount]),
    ).toEqual([
      [0, 1],
      [1, 9],
      [2, 10],
      [3, 0],
    ]);
  });

  it("returns a season's episodes in order", async () => {
    const season = await caller.media.season({ providerId: SEVERANCE, seasonNumber: 1 });

    expect(season).toMatchObject({ name: "Season 1", show: { title: "Severance" } });
    expect(season.episodes.map((episode) => episode.episodeNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(season.episodes[0]).toMatchObject({ name: "Good News About Hell" });
  });

  it("keeps the same season and episode records when a show is refreshed", async () => {
    await caller.media.tvShow({ providerId: SEVERANCE });
    const before = await db.select({ id: episodes.id }).from(episodes).orderBy(episodes.id);
    await db.update(seasons).set({ name: "Renamed" }).where(eq(seasons.seasonNumber, 1));
    await db.update(media).set({ syncedAt: new Date(Date.now() - EIGHT_DAYS_MS) });

    const show = await caller.media.tvShow({ providerId: SEVERANCE });

    expect(show.seasons.find((season) => season.seasonNumber === 1)?.name).toBe("Season 1");
    expect(await db.select({ id: episodes.id }).from(episodes).orderBy(episodes.id)).toEqual(
      before,
    );
  });

  it("answers NOT_FOUND for a season the show does not have", async () => {
    await expect(
      caller.media.season({ providerId: SEVERANCE, seasonNumber: 99 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

import { db } from "@yousiverse/db";
import { episodes, media } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/root";

const caller = appRouter.createCaller({ db, session: null });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const SEVERANCE = "95396";

describe("media.shelf", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  it("returns an empty shelf when the catalog is empty", async () => {
    expect(await caller.media.shelf()).toEqual([]);
  });

  it("returns titles of every type, most recently added first", async () => {
    await db.insert(media).values([
      {
        type: "game",
        title: "Hades",
        provider: "igdb",
        providerId: "113112",
        createdAt: minutesAgo(3),
      },
      {
        type: "book",
        title: "Dune",
        provider: "open_library",
        providerId: "OL893414W",
        createdAt: minutesAgo(1),
      },
      {
        type: "tv",
        title: "Arcane",
        provider: "tmdb",
        providerId: "94605",
        createdAt: minutesAgo(2),
      },
    ]);

    const shelf = await caller.media.shelf();

    expect(shelf.map(({ type, title, providerId }) => ({ type, title, providerId }))).toEqual([
      { type: "book", title: "Dune", providerId: "OL893414W" },
      { type: "tv", title: "Arcane", providerId: "94605" },
      { type: "game", title: "Hades", providerId: "113112" },
    ]);
  });

  it("leaves out titles that have no page to link to", async () => {
    await db.insert(media).values({ type: "movie", title: "No provider" });

    expect(await caller.media.shelf()).toEqual([]);
  });

  it("caps the shelf at 24 items", async () => {
    await db.insert(media).values(
      Array.from({ length: 30 }, (_, index) => ({
        type: "movie" as const,
        title: `Movie ${index}`,
        provider: "tmdb" as const,
        providerId: String(index + 1),
      })),
    );

    expect(await caller.media.shelf()).toHaveLength(24);
  });
});

describe("media.season and media.episode", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  it("returns a season with the show it belongs to and each episode's still", async () => {
    const show = await caller.media.tvShow({ providerId: SEVERANCE });

    const season = await caller.media.season({ providerId: SEVERANCE, seasonNumber: 1 });

    expect(season.show).toEqual({
      mediaId: show.id,
      providerId: SEVERANCE,
      title: "Severance",
      posterUrl: show.posterUrl,
      backdropUrl: show.backdropUrl,
      artHue: show.artHue,
      artSaturation: show.artSaturation,
    });
    expect(season.show.backdropUrl).toMatch(/^https:\/\/image\.tmdb\.org\//);
    expect(season.episodes[0]?.stillUrl).toMatch(/^https:\/\/image\.tmdb\.org\//);
  });

  it("returns an episode with its still, its show, and the episodes either side of it", async () => {
    const show = await caller.media.tvShow({ providerId: SEVERANCE });

    const episode = await caller.media.episode({
      providerId: SEVERANCE,
      seasonNumber: 1,
      episodeNumber: 2,
    });

    expect(episode).toMatchObject({
      name: "Half Loop",
      season: { seasonNumber: 1, name: "Season 1" },
      show: { mediaId: show.id, providerId: SEVERANCE, title: "Severance" },
      previous: 1,
      next: 3,
    });
    expect(episode.stillUrl).toMatch(/^https:\/\/image\.tmdb\.org\//);
    expect(episode.show.backdropUrl).toBe(show.backdropUrl);
    expect(episode).not.toHaveProperty("seasonId");
  });

  it("has no previous episode at the start of a season and no next one at its end", async () => {
    const first = await caller.media.episode({
      providerId: SEVERANCE,
      seasonNumber: 1,
      episodeNumber: 1,
    });
    const last = await caller.media.episode({
      providerId: SEVERANCE,
      seasonNumber: 1,
      episodeNumber: 9,
    });

    // Season 2 follows, but the links stay inside the season.
    expect(first).toMatchObject({ previous: null, next: 2 });
    expect(last).toMatchObject({ previous: 8, next: null });
  });

  it("skips over a missing episode number when finding the episodes either side", async () => {
    const season = await caller.media.season({ providerId: SEVERANCE, seasonNumber: 1 });
    const third = season.episodes.find((episode) => episode.episodeNumber === 3);
    await db.delete(episodes).where(eq(episodes.id, third?.id ?? ""));

    expect(
      await caller.media.episode({ providerId: SEVERANCE, seasonNumber: 1, episodeNumber: 2 }),
    ).toMatchObject({ previous: 1, next: 4 });
  });
});

describe("media.episodes", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  it("returns every season of a show with its episodes, in order", async () => {
    const show = await caller.media.tvShow({ providerId: SEVERANCE });

    const seasons = await caller.media.episodes({ mediaId: show.id });

    expect(seasons.map((season) => [season.seasonNumber, season.episodes.length])).toEqual([
      [0, 1],
      [1, 9],
      [2, 10],
      [3, 0],
    ]);
    const first = seasons.find((season) => season.seasonNumber === 1);
    expect(first?.name).toBe("Season 1");
    expect(first?.episodes.map((episode) => episode.episodeNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(first?.episodes[0]).toMatchObject({
      name: "Good News About Hell",
      airDate: "2022-02-17",
      stillUrl: expect.stringMatching(/^https:\/\/image\.tmdb\.org\//),
    });
    expect(first?.episodes[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is empty for a title with no seasons and for a title that does not exist", async () => {
    const [movie] = await db
      .insert(media)
      .values({ type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" })
      .returning({ id: media.id });

    expect(await caller.media.episodes({ mediaId: movie?.id ?? "" })).toEqual([]);
    expect(
      await caller.media.episodes({ mediaId: "00000000-0000-4000-8000-000000000000" }),
    ).toEqual([]);
  });

  it("does not ask the provider for anything", async () => {
    // No response is recorded for this show, so asking the provider would fail the request.
    const [show] = await db
      .insert(media)
      .values({ type: "tv", title: "Offline", provider: "tmdb", providerId: "424242" })
      .returning({ id: media.id });

    expect(await caller.media.episodes({ mediaId: show?.id ?? "" })).toEqual([]);
  });
});

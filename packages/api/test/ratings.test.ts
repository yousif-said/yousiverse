import { db } from "@yousiverse/db";
import { episodes, media, ratings, seasons, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

async function addTitles() {
  const [movie, show] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396" },
    ])
    .returning({ id: media.id });
  if (!movie || !show) throw new Error("Titles were not created.");
  const [season] = await db
    .insert(seasons)
    .values({ mediaId: show.id, seasonNumber: 1, name: "Season 1" })
    .returning({ id: seasons.id });
  if (!season) throw new Error("Season was not created.");
  const [first, second] = await db
    .insert(episodes)
    .values([
      { seasonId: season.id, episodeNumber: 1, name: "Good News About Hell" },
      { seasonId: season.id, episodeNumber: 2, name: "Half Loop" },
    ])
    .returning({ id: episodes.id });
  if (!first || !second) throw new Error("Episodes were not created.");
  return { movie: movie.id, show: show.id, season: season.id, first: first.id, second: second.id };
}

const missingId = "00000000-0000-4000-8000-000000000000";

describe("ratings", () => {
  let ids: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    ids = await addTitles();
  });

  it("requires signing in to rate", async () => {
    await expect(
      anonymous.ratings.save({ target: { mediaId: ids.movie }, value: 30 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("shows a title with no ratings as unrated", async () => {
    expect(await anonymous.ratings.summary({ target: { mediaId: ids.movie } })).toEqual({
      average: null,
      count: 0,
      mine: null,
    });
  });

  it("stores a rating in quarter points and replaces it when the person rates again", async () => {
    const { caller } = await signedInAs("Ada");

    await caller.ratings.save({ target: { mediaId: ids.movie }, value: 30 });
    await caller.ratings.save({ target: { mediaId: ids.movie }, value: 33 });

    expect(await caller.ratings.summary({ target: { mediaId: ids.movie } })).toEqual({
      average: 33,
      count: 1,
      mine: 33,
    });
  });

  it("accepts the lowest and highest ratings and nothing outside them", async () => {
    const { caller } = await signedInAs("Ada");
    const rate = (value: number) => caller.ratings.save({ target: { mediaId: ids.movie }, value });

    await rate(0);
    expect((await caller.ratings.summary({ target: { mediaId: ids.movie } })).mine).toBe(0);
    await rate(40);
    expect((await caller.ratings.summary({ target: { mediaId: ids.movie } })).mine).toBe(40);

    await expect(rate(41)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(rate(-1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(rate(8.25)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("is protected by the database against out-of-range values", async () => {
    const { user } = await signedInAs("Ada");

    await expect(
      db.insert(ratings).values({ userId: user.id, mediaId: ids.movie, value: 41 }),
    ).rejects.toThrow();
  });

  it("averages everyone's ratings and shows each person only their own", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.ratings.save({ target: { mediaId: ids.movie }, value: 40 });
    await grace.caller.ratings.save({ target: { mediaId: ids.movie }, value: 31 });

    expect(await ada.caller.ratings.summary({ target: { mediaId: ids.movie } })).toEqual({
      average: 35.5,
      count: 2,
      mine: 40,
    });
    expect(await grace.caller.ratings.summary({ target: { mediaId: ids.movie } })).toMatchObject({
      mine: 31,
    });
    expect(await anonymous.ratings.summary({ target: { mediaId: ids.movie } })).toEqual({
      average: 35.5,
      count: 2,
      mine: null,
    });
  });

  it("removes only the asking person's rating", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.ratings.save({ target: { mediaId: ids.movie }, value: 40 });
    await grace.caller.ratings.save({ target: { mediaId: ids.movie }, value: 20 });

    await grace.caller.ratings.remove({ target: { mediaId: ids.movie } });

    expect(await grace.caller.ratings.summary({ target: { mediaId: ids.movie } })).toEqual({
      average: 40,
      count: 1,
      mine: null,
    });
  });

  it("refuses to rate a title or episode that does not exist", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.ratings.save({ target: { mediaId: missingId }, value: 20 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.ratings.save({ target: { episodeId: missingId }, value: 20 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rates episodes separately from each other and from the show", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.ratings.save({ target: { mediaId: ids.show }, value: 36 });
    await ada.caller.ratings.save({ target: { episodeId: ids.first }, value: 38 });
    await ada.caller.ratings.save({ target: { episodeId: ids.first }, value: 40 });
    await grace.caller.ratings.save({ target: { episodeId: ids.first }, value: 30 });

    expect(await ada.caller.ratings.summary({ target: { mediaId: ids.show } })).toEqual({
      average: 36,
      count: 1,
      mine: 36,
    });
    expect(await ada.caller.ratings.forSeason({ seasonId: ids.season })).toEqual([
      { episodeId: ids.first, average: 35, count: 2, mine: 40 },
    ]);
    expect(await anonymous.ratings.forSeason({ seasonId: ids.season })).toEqual([
      { episodeId: ids.first, average: 35, count: 2, mine: null },
    ]);
    expect(await grace.caller.ratings.summary({ target: { episodeId: ids.first } })).toEqual({
      average: 35,
      count: 2,
      mine: 30,
    });
  });

  it("removes an episode rating without touching the show's rating", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.ratings.save({ target: { mediaId: ids.show }, value: 36 });
    await caller.ratings.save({ target: { episodeId: ids.second }, value: 20 });

    await caller.ratings.remove({ target: { episodeId: ids.second } });

    expect(await caller.ratings.forSeason({ seasonId: ids.season })).toEqual([]);
    expect((await caller.ratings.summary({ target: { mediaId: ids.show } })).mine).toBe(36);
  });
});

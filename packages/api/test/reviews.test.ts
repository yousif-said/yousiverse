import { db } from "@yousiverse/db";
import { episodes, media, seasons, users } from "@yousiverse/db/schema";
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
  const [episode] = await db
    .insert(episodes)
    .values({ seasonId: season.id, episodeNumber: 1, name: "Good News About Hell" })
    .returning({ id: episodes.id });
  if (!episode) throw new Error("Episode was not created.");
  return {
    movie: { mediaId: movie.id },
    show: { mediaId: show.id },
    episode: { episodeId: episode.id },
  };
}

describe("reviews", () => {
  let targets: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    targets = await addTitles();
  });

  it("requires signing in to write a review", async () => {
    await expect(
      anonymous.reviews.save({ target: targets.movie, body: "Whoa." }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("has no reviews for a title nobody has reviewed", async () => {
    expect(await anonymous.reviews.list({ target: targets.movie })).toEqual({
      mine: null,
      others: [],
    });
  });

  it("publishes a review to everyone by default, with its author's username and rating", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.ratings.save({ target: targets.movie, value: 38 });
    await ada.caller.reviews.save({ target: targets.movie, body: "  Still holds up.  " });

    expect(await ada.caller.reviews.list({ target: targets.movie })).toEqual({
      mine: { body: "Still holds up.", visibility: "public" },
      others: [],
    });
    for (const reader of [grace.caller, anonymous]) {
      const { mine, others } = await reader.reviews.list({ target: targets.movie });
      expect(mine).toBeNull();
      expect(others).toMatchObject([{ author: "ada", body: "Still holds up.", rating: 38 }]);
    }
  });

  it("shows a review without a rating when its author has not rated the title", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.reviews.save({ target: targets.movie, body: "No score from me." });

    const { others } = await anonymous.reviews.list({ target: targets.movie });

    expect(others).toMatchObject([{ author: "ada", rating: null }]);
  });

  it("credits nobody by name when the author has not chosen a username", async () => {
    const ada = await signedInAs("Ada", { username: false });
    await ada.caller.reviews.save({ target: targets.movie, body: "Anonymous for now." });

    const { others } = await anonymous.reviews.list({ target: targets.movie });

    expect(others).toMatchObject([{ author: null, body: "Anonymous for now." }]);
  });

  it("never shows a private review to anyone but its author", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.reviews.save({
      target: targets.movie,
      body: "Just for me.",
      visibility: "private",
    });

    expect((await ada.caller.reviews.list({ target: targets.movie })).mine).toEqual({
      body: "Just for me.",
      visibility: "private",
    });
    expect((await grace.caller.reviews.list({ target: targets.movie })).others).toEqual([]);
    expect((await anonymous.reviews.list({ target: targets.movie })).others).toEqual([]);
  });

  it("hides a public review once its author makes it private", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.reviews.save({ target: targets.movie, body: "Second thoughts." });

    await ada.caller.reviews.save({
      target: targets.movie,
      body: "Second thoughts.",
      visibility: "private",
    });

    expect((await anonymous.reviews.list({ target: targets.movie })).others).toEqual([]);
  });

  it("rewrites a review in place and keeps who can see it", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.reviews.save({ target: targets.movie, body: "Draft.", visibility: "private" });

    await ada.caller.reviews.save({ target: targets.movie, body: "Final." });

    expect((await ada.caller.reviews.list({ target: targets.movie })).mine).toEqual({
      body: "Final.",
      visibility: "private",
    });
  });

  it("rejects an empty review and one that is too long", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(caller.reviews.save({ target: targets.movie, body: "   " })).rejects.toMatchObject(
      { code: "BAD_REQUEST" },
    );
    await expect(
      caller.reviews.save({ target: targets.movie, body: "a".repeat(10_001) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("removes only the asking person's review", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.reviews.save({ target: targets.movie, body: "Mine." });
    await grace.caller.reviews.save({ target: targets.movie, body: "Hers." });

    await grace.caller.reviews.remove({ target: targets.movie });

    const { others } = await anonymous.reviews.list({ target: targets.movie });
    expect(others.map((review) => review.body)).toEqual(["Mine."]);
  });

  it("keeps reviews of an episode apart from reviews of its show", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.ratings.save({ target: targets.show, value: 36 });
    await ada.caller.ratings.save({ target: targets.episode, value: 40 });
    await ada.caller.reviews.save({ target: targets.show, body: "Great show." });
    await ada.caller.reviews.save({ target: targets.episode, body: "Great pilot." });

    expect((await anonymous.reviews.list({ target: targets.show })).others).toMatchObject([
      { body: "Great show.", rating: 36 },
    ]);
    expect((await anonymous.reviews.list({ target: targets.episode })).others).toMatchObject([
      { body: "Great pilot.", rating: 40 },
    ]);
  });

  it("refuses to review an episode that does not exist", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.reviews.save({
        target: { episodeId: "00000000-0000-4000-8000-000000000000" },
        body: "Lost episode.",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

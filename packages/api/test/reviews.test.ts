import { db } from "@yousiverse/db";
import { episodes, media, profiles, reviews, seasons, users } from "@yousiverse/db/schema";
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
      count: 0,
    });
  });

  it("publishes a review to everyone by default, with its author's username and rating", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.ratings.save({ target: targets.movie, value: 38 });
    await ada.caller.reviews.save({ target: targets.movie, body: "  Still holds up.  " });

    expect(await ada.caller.reviews.list({ target: targets.movie })).toEqual({
      mine: {
        body: "Still holds up.",
        visibility: "public",
        rating: 38,
        createdAt: expect.any(Date),
      },
      others: [],
      count: 1,
    });
    for (const reader of [grace.caller, anonymous]) {
      const { mine, others, count } = await reader.reviews.list({ target: targets.movie });
      expect(mine).toBeNull();
      expect(others).toEqual([
        {
          id: expect.any(String),
          author: "ada",
          body: "Still holds up.",
          rating: 38,
          createdAt: expect.any(Date),
          following: false,
        },
      ]);
      expect(count).toBe(1);
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

    expect(await ada.caller.reviews.list({ target: targets.movie })).toMatchObject({
      mine: { body: "Just for me.", visibility: "private", rating: null },
      count: 1,
    });
    for (const reader of [grace.caller, anonymous]) {
      expect(await reader.reviews.list({ target: targets.movie })).toEqual({
        mine: null,
        others: [],
        count: 0,
      });
    }
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

    expect((await ada.caller.reviews.list({ target: targets.movie })).mine).toMatchObject({
      body: "Final.",
      visibility: "private",
    });
  });

  it("keeps the day a review was first posted when it is rewritten", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.reviews.save({ target: targets.movie, body: "Draft." });
    const posted = (await ada.caller.reviews.list({ target: targets.movie })).mine?.createdAt;

    await ada.caller.reviews.save({ target: targets.movie, body: "Final." });

    expect(posted).toBeInstanceOf(Date);
    expect((await ada.caller.reviews.list({ target: targets.movie })).mine?.createdAt).toEqual(
      posted,
    );
  });

  it("lists people the reader follows first, then everyone else, newest first in each", async () => {
    const ada = await signedInAs("Ada");
    const [grace, linus, marie, joan] = await Promise.all(
      ["Grace", "Linus", "Marie", "Joan"].map((name) => signedInAs(name)),
    );
    if (!grace || !linus || !marie || !joan) throw new Error("Reviewers were not created.");
    for (const writer of [grace, linus, marie, joan, ada]) {
      await writer.caller.reviews.save({ target: targets.movie, body: `By ${writer.user.name}.` });
    }
    await ada.caller.follows.follow({ username: "grace" });
    await ada.caller.follows.follow({ username: "marie" });
    // Being followed by someone does not put their review first.
    await joan.caller.follows.follow({ username: "ada" });

    const forAda = await ada.caller.reviews.list({ target: targets.movie });
    expect(forAda.mine).toMatchObject({ body: "By Ada." });
    expect(forAda.others.map((review) => [review.author, review.following])).toEqual([
      ["marie", true],
      ["grace", true],
      ["joan", false],
      ["linus", false],
    ]);
    expect(forAda.count).toBe(5);

    const forVisitor = await anonymous.reviews.list({ target: targets.movie });
    expect(forVisitor.others.map((review) => [review.author, review.following])).toEqual([
      ["ada", false],
      ["joan", false],
      ["marie", false],
      ["linus", false],
      ["grace", false],
    ]);
    expect(forVisitor.count).toBe(5);
  });

  it("shows a friends-only review to a follower only once its author follows back", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await grace.caller.reviews.save({
      target: targets.movie,
      body: "Between friends.",
      visibility: "friends",
    });
    await ada.caller.follows.follow({ username: "grace" });

    expect(await ada.caller.reviews.list({ target: targets.movie })).toEqual({
      mine: null,
      others: [],
      count: 0,
    });

    await grace.caller.follows.follow({ username: "ada" });

    const { others, count } = await ada.caller.reviews.list({ target: targets.movie });
    expect(others).toMatchObject([{ author: "grace", body: "Between friends.", following: true }]);
    expect(count).toBe(1);
  });

  it("counts only the reviews the reader may see, their own included", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    await ada.caller.reviews.save({ target: targets.movie, body: "Mine.", visibility: "private" });
    await grace.caller.reviews.save({ target: targets.movie, body: "Hers." });
    await linus.caller.reviews.save({ target: targets.movie, body: "His.", visibility: "private" });
    await linus.caller.reviews.save({ target: targets.episode, body: "Another target." });

    expect((await ada.caller.reviews.list({ target: targets.movie })).count).toBe(2);
    expect((await grace.caller.reviews.list({ target: targets.movie })).count).toBe(1);
    expect((await anonymous.reviews.list({ target: targets.movie })).count).toBe(1);
  });

  it("keeps a followed person's review when there are more reviews than it shows", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await grace.caller.reviews.save({ target: targets.movie, body: "The oldest one." });
    await ada.caller.follows.follow({ username: "grace" });
    const crowd = Array.from({ length: 55 }, (_, n) => ({ id: `user-crowd-${n}`, n }));
    await db
      .insert(users)
      .values(
        crowd.map(({ id, n }) => ({ id, name: `Crowd ${n}`, email: `crowd${n}@example.com` })),
      );
    await db
      .insert(profiles)
      .values(crowd.map(({ id, n }) => ({ userId: id, username: `crowd_${n}` })));
    await db
      .insert(reviews)
      .values(crowd.map(({ id }) => ({ userId: id, ...targets.movie, body: "One of many." })));

    const { others, count } = await ada.caller.reviews.list({ target: targets.movie });

    expect(others).toHaveLength(50);
    expect(others[0]).toMatchObject({ author: "grace", following: true });
    expect(count).toBe(56);
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

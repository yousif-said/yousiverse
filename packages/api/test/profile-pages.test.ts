import { db } from "@yousiverse/db";
import { episodes, media, seasons, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { MIN_SHARED_RATINGS } from "../src/routers/profiles";
import { anonymous, signedInAs } from "./helpers";

type Person = Awaited<ReturnType<typeof signedInAs>>;

async function addTitles() {
  const [matrix, hades, show, dune] = await db
    .insert(media)
    .values([
      {
        type: "movie",
        title: "The Matrix",
        provider: "tmdb",
        providerId: "603",
        releaseYear: 1999,
        posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
        artHue: 140,
        artSaturation: 60,
      },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396" },
      { type: "book", title: "Dune", provider: "open_library", providerId: "OL893414W" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !show || !dune) throw new Error("Titles were not created.");
  const [season] = await db
    .insert(seasons)
    .values({ mediaId: show.id, seasonNumber: 1, name: "Season 1" })
    .returning({ id: seasons.id });
  if (!season) throw new Error("Season was not created.");
  const [episode] = await db
    .insert(episodes)
    .values({ seasonId: season.id, episodeNumber: 2, name: "Half Loop" })
    .returning({ id: episodes.id });
  if (!episode) throw new Error("Episode was not created.");
  return {
    matrix: matrix.id,
    hades: hades.id,
    show: show.id,
    dune: dune.id,
    episode: episode.id,
  };
}

/** Puts a title in a person's library as finished and rates it, in quarter points. */
async function finishAndRate(
  person: Person,
  mediaId: string,
  value: number,
  visibility: "public" | "friends" | "private" = "public",
) {
  await person.caller.library.save({ mediaId, status: "finished", visibility });
  await person.caller.ratings.save({ target: { mediaId }, value });
}

async function befriend(a: Person, b: Person) {
  await a.caller.follows.follow({ username: b.user.name.toLowerCase() });
  await b.caller.follows.follow({ username: a.user.name.toLowerCase() });
}

describe("public profiles", () => {
  let ids: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    ids = await addTitles();
  });

  it("shows a profile to anyone, whatever capitals the address uses", async () => {
    const ada = await signedInAs("Ada");

    expect(await anonymous.profiles.get({ username: "ADA" })).toMatchObject({
      username: "ada",
      name: "Ada",
      isOwner: false,
    });
    expect(await ada.caller.profiles.get({ username: "ada" })).toMatchObject({ isOwner: true });
  });

  it("answers NOT_FOUND for a username nobody has", async () => {
    await signedInAs("Ada", { username: false });

    for (const username of ["ada", "no such person", ""]) {
      await expect(anonymous.profiles.get({ username })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(anonymous.profiles.library({ username: "ada" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("never exposes an email address", async () => {
    await signedInAs("Ada");

    const profile = await anonymous.profiles.get({ username: "ada" });

    expect(JSON.stringify(profile)).not.toContain("@example.com");
  });

  it("shows only the public part of a library, even to its owner", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await ada.caller.library.save({ mediaId: ids.hades, status: "want", visibility: "private" });

    for (const reader of [anonymous, ada.caller]) {
      const entries = await reader.profiles.library({ username: "ada" });
      expect(entries.map(({ title, status }) => ({ title, status }))).toEqual([
        { title: "The Matrix", status: "finished" },
      ]);
    }
  });

  it("filters a public library by type and status", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await ada.caller.library.save({ mediaId: ids.hades, status: "in_progress" });

    const titlesOf = async (filter: Parameters<typeof anonymous.profiles.library>[0]) =>
      (await anonymous.profiles.library(filter)).map((entry) => entry.title);
    expect(await titlesOf({ username: "ada", type: "game" })).toEqual(["Hades"]);
    expect(await titlesOf({ username: "ada", status: "finished" })).toEqual(["The Matrix"]);
    expect(await titlesOf({ username: "ada", type: "game", status: "finished" })).toEqual([]);
  });

  it("keeps one person's library off another person's profile", async () => {
    const ada = await signedInAs("Ada");
    await signedInAs("Grace");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });

    expect(await anonymous.profiles.library({ username: "grace" })).toEqual([]);
  });

  it("draws a library entry from its title's artwork and the person's own rating", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await finishAndRate(ada, ids.matrix, 36);
    await ada.caller.ratings.save({ target: { episodeId: ids.episode }, value: 8 });
    await ada.caller.library.save({ mediaId: ids.show, status: "in_progress" });
    await grace.caller.ratings.save({ target: { mediaId: ids.show }, value: 40 });

    expect(await anonymous.profiles.library({ username: "ada" })).toEqual([
      {
        mediaId: ids.matrix,
        type: "movie",
        providerId: "603",
        title: "The Matrix",
        releaseYear: 1999,
        posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
        backdropUrl: null,
        artHue: 140,
        artSaturation: 60,
        posterAspect: null,
        status: "finished",
        rating: 36,
      },
      // Neither Ada's rating of one episode nor Grace's rating of the show is Ada's rating of it.
      expect.objectContaining({ title: "Severance", status: "in_progress", rating: null }),
    ]);
  });

  it("puts the titles a person rated highest first in their library", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.show, status: "want" });
    await finishAndRate(ada, ids.hades, 28);
    await finishAndRate(ada, ids.matrix, 38);

    const library = await anonymous.profiles.library({ username: "ada" });

    expect(library.map((entry) => entry.title)).toEqual(["The Matrix", "Hades", "Severance"]);
  });

  it("lists public lists with their sizes and first titles, and leaves private ones out", async () => {
    const ada = await signedInAs("Ada");
    const favorites = await ada.caller.lists.create({
      name: "Favorites",
      description: "Watched more than once.",
    });
    for (const mediaId of [ids.hades, ids.matrix, ids.show, ids.dune]) {
      await ada.caller.lists.addItem({ listId: favorites.id, mediaId });
    }
    const empty = await ada.caller.lists.create({ name: "Empty" });
    await ada.caller.lists.create({ name: "Secret", visibility: "private" });

    const found = await anonymous.profiles.lists({ username: "ada" });

    expect(found).toEqual([
      {
        id: empty.id,
        name: "Empty",
        description: null,
        visibility: "public",
        itemCount: 0,
        artwork: [],
      },
      {
        id: favorites.id,
        name: "Favorites",
        description: "Watched more than once.",
        visibility: "public",
        itemCount: 4,
        artwork: [
          expect.objectContaining({ mediaId: ids.hades, title: "Hades", providerId: "113112" }),
          expect.objectContaining({ title: "The Matrix", artHue: 140, releaseYear: 1999 }),
          expect.objectContaining({ title: "Severance", type: "tv" }),
          expect.objectContaining({ title: "Dune" }),
        ],
      },
    ]);
    expect(Object.keys(found[1]?.artwork[0] ?? {}).sort()).toEqual([
      "artHue",
      "artSaturation",
      "backdropUrl",
      "mediaId",
      "posterAspect",
      "posterUrl",
      "providerId",
      "releaseYear",
      "title",
      "type",
    ]);
  });

  it("shows only the first four titles of a longer list, and counts them all", async () => {
    const ada = await signedInAs("Ada");
    const list = await ada.caller.lists.create({ name: "Long" });
    const [fifth] = await db
      .insert(media)
      .values({ type: "movie", title: "Fifth", provider: "tmdb", providerId: "5" })
      .returning({ id: media.id });
    for (const mediaId of [ids.matrix, ids.hades, ids.show, ids.dune, fifth?.id ?? ""]) {
      await ada.caller.lists.addItem({ listId: list.id, mediaId });
    }

    const [found] = await anonymous.profiles.lists({ username: "ada" });

    expect(found?.itemCount).toBe(5);
    expect(found?.artwork.map((title) => title.title)).toEqual([
      "The Matrix",
      "Hades",
      "Severance",
      "Dune",
    ]);
  });

  it("shows public reviews with what they are about and leaves private ones out", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.ratings.save({ target: { mediaId: ids.matrix }, value: 38 });
    await ada.caller.reviews.save({ target: { mediaId: ids.matrix }, body: "Still holds up." });
    await ada.caller.reviews.save({ target: { episodeId: ids.episode }, body: "Defiant jazz." });
    await ada.caller.reviews.save({
      target: { mediaId: ids.hades },
      body: "Private notes.",
      visibility: "private",
    });

    const found = await anonymous.profiles.reviews({ username: "ada" });

    expect(found).toHaveLength(2);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Still holds up.",
          rating: 38,
          mediaId: ids.matrix,
          type: "movie",
          title: "The Matrix",
          providerId: "603",
          releaseYear: 1999,
          posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
          artHue: 140,
          episode: null,
        }),
        expect.objectContaining({
          body: "Defiant jazz.",
          rating: null,
          title: "Severance",
          episode: { name: "Half Loop", episodeNumber: 2, seasonNumber: 1 },
        }),
      ]),
    );
  });

  describe("a person's taste in numbers", () => {
    it("counts titles and averages ratings per medium, with nothing for an empty medium", async () => {
      const ada = await signedInAs("Ada");
      await finishAndRate(ada, ids.matrix, 36);
      await finishAndRate(ada, ids.hades, 30);
      await ada.caller.library.save({ mediaId: ids.show, status: "want" });
      const [second] = await db
        .insert(media)
        .values({ type: "movie", title: "Heat", provider: "tmdb", providerId: "949" })
        .returning({ id: media.id });
      await finishAndRate(ada, second?.id ?? "", 31);

      const stats = await anonymous.profiles.stats({ username: "ada" });

      expect(stats.media).toEqual([
        { type: "movie", titles: 2, average: 33.5 },
        { type: "tv", titles: 1, average: null },
        { type: "game", titles: 1, average: 30 },
        { type: "book", titles: 0, average: null },
      ]);
      expect(stats.ratings.count).toBe(3);
      expect(stats.ratings.average).toBeCloseTo(97 / 3);
      expect(stats.counts).toEqual({ titles: 4, reviews: 0, lists: 0 });
    });

    it("spreads ratings over 21 half points, a quarter point counting with the half below", async () => {
      const ada = await signedInAs("Ada");
      await finishAndRate(ada, ids.matrix, 40);
      await finishAndRate(ada, ids.hades, 33);
      await finishAndRate(ada, ids.show, 32);
      await finishAndRate(ada, ids.dune, 0);

      const { histogram } = (await anonymous.profiles.stats({ username: "ada" })).ratings;

      expect(histogram).toHaveLength(21);
      expect(histogram[0]).toBe(1);
      expect(histogram[16]).toBe(2);
      expect(histogram[20]).toBe(1);
      expect(histogram.reduce((sum, bar) => sum + bar, 0)).toBe(4);
    });

    it("lists the highest rated titles first, ready to draw", async () => {
      const ada = await signedInAs("Ada");
      await finishAndRate(ada, ids.hades, 30);
      await finishAndRate(ada, ids.matrix, 38);
      await ada.caller.library.save({ mediaId: ids.show, status: "want" });

      const { highestRated } = await anonymous.profiles.stats({ username: "ada" });

      expect(highestRated).toEqual([
        expect.objectContaining({
          mediaId: ids.matrix,
          title: "The Matrix",
          providerId: "603",
          artHue: 140,
          rating: 38,
        }),
        expect.objectContaining({ title: "Hades", rating: 30 }),
      ]);
    });

    it("leaves ratings of episodes and of titles outside the library out of the numbers", async () => {
      const ada = await signedInAs("Ada");
      await ada.caller.library.save({ mediaId: ids.show, status: "in_progress" });
      await ada.caller.ratings.save({ target: { episodeId: ids.episode }, value: 40 });
      await ada.caller.ratings.save({ target: { mediaId: ids.matrix }, value: 40 });

      const stats = await anonymous.profiles.stats({ username: "ada" });

      expect(stats.ratings).toMatchObject({ count: 0, average: null });
      expect(stats.highestRated).toEqual([]);
      expect(stats.counts.titles).toBe(1);
    });

    it("never lets a private entry into the numbers, even for its owner", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      await befriend(ada, grace);
      await finishAndRate(ada, ids.matrix, 36);
      await finishAndRate(ada, ids.hades, 8, "private");
      await ada.caller.reviews.save({
        target: { mediaId: ids.hades },
        body: "Private notes.",
        visibility: "private",
      });
      await ada.caller.lists.create({ name: "Secret", visibility: "private" });

      for (const reader of [anonymous, grace.caller, ada.caller]) {
        const stats = await reader.profiles.stats({ username: "ada" });
        expect(stats.media.find((medium) => medium.type === "game")).toEqual({
          type: "game",
          titles: 0,
          average: null,
        });
        expect(stats.ratings).toMatchObject({ count: 1, average: 36 });
        expect(stats.ratings.histogram[4]).toBe(0);
        expect(stats.highestRated.map((title) => title.title)).toEqual(["The Matrix"]);
        expect(stats.counts).toEqual({ titles: 1, reviews: 0, lists: 0 });
      }
    });

    it("counts friends-only entries, reviews, and lists for a friend and for no one else", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const linus = await signedInAs("Linus");
      await befriend(ada, grace);
      await linus.caller.follows.follow({ username: "ada" });
      await finishAndRate(ada, ids.matrix, 36);
      await finishAndRate(ada, ids.hades, 20, "friends");
      await ada.caller.reviews.save({
        target: { mediaId: ids.hades },
        body: "For friends.",
        visibility: "friends",
      });
      await ada.caller.lists.create({ name: "For friends", visibility: "friends" });

      const friend = await grace.caller.profiles.stats({ username: "ada" });
      expect(friend.ratings).toMatchObject({ count: 2, average: 28 });
      expect(friend.highestRated.map((title) => title.title)).toEqual(["The Matrix", "Hades"]);
      expect(friend.counts).toEqual({ titles: 2, reviews: 1, lists: 1 });

      for (const reader of [anonymous, linus.caller, ada.caller]) {
        const stats = await reader.profiles.stats({ username: "ada" });
        expect(stats.ratings).toMatchObject({ count: 1, average: 36 });
        expect(stats.counts).toEqual({ titles: 1, reviews: 0, lists: 0 });
      }
    });

    it("answers NOT_FOUND for a username nobody has", async () => {
      await expect(anonymous.profiles.stats({ username: "nobody" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(anonymous.profiles.match({ username: "nobody" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("how closely two people's ratings agree", () => {
    it("is 100% for the same ratings and falls as they drift apart", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const linus = await signedInAs("Linus");
      for (const [mediaId, value] of [
        [ids.matrix, 36],
        [ids.hades, 30],
        [ids.show, 20],
      ] as const) {
        await finishAndRate(ada, mediaId, value);
        await grace.caller.ratings.save({ target: { mediaId }, value });
        // One point out of ten away from Ada on every title.
        await linus.caller.ratings.save({ target: { mediaId }, value: value - 4 });
      }

      expect(await grace.caller.profiles.match({ username: "ada" })).toMatchObject({
        percent: 100,
        shared: 3,
      });
      expect(await linus.caller.profiles.match({ username: "ada" })).toMatchObject({
        percent: 74,
        shared: 3,
      });
    });

    it("never goes below zero, however far apart two people are", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      for (const mediaId of [ids.matrix, ids.hades, ids.show]) {
        await finishAndRate(ada, mediaId, 40);
        await grace.caller.ratings.save({ target: { mediaId }, value: 0 });
      }

      expect(await grace.caller.profiles.match({ username: "ada" })).toMatchObject({ percent: 0 });
    });

    it("names the titles both rated 8.5 or more, the highest first", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      await finishAndRate(ada, ids.matrix, 36);
      await finishAndRate(ada, ids.hades, 40);
      await finishAndRate(ada, ids.show, 38);
      await grace.caller.ratings.save({ target: { mediaId: ids.matrix }, value: 34 });
      await grace.caller.ratings.save({ target: { mediaId: ids.hades }, value: 38 });
      await grace.caller.ratings.save({ target: { mediaId: ids.show }, value: 33 });

      const match = await grace.caller.profiles.match({ username: "ada" });

      expect(match?.bothLoved).toEqual([
        expect.objectContaining({ mediaId: ids.hades, title: "Hades", providerId: "113112" }),
        expect.objectContaining({ title: "The Matrix", artHue: 140 }),
      ]);
      expect(match?.bothLoved[0]).not.toHaveProperty("theirs");
      expect(match?.bothLoved[0]).not.toHaveProperty("mine");
    });

    it("says nothing for a visitor, for one's own profile, or with too few shared ratings", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const shared = [ids.matrix, ids.hades, ids.show].slice(0, MIN_SHARED_RATINGS - 1);
      for (const mediaId of [ids.matrix, ids.hades, ids.show]) {
        await finishAndRate(ada, mediaId, 36);
      }
      for (const mediaId of shared) {
        await grace.caller.ratings.save({ target: { mediaId }, value: 36 });
      }

      expect(await anonymous.profiles.match({ username: "ada" })).toBeNull();
      expect(await ada.caller.profiles.match({ username: "ada" })).toBeNull();
      expect(await grace.caller.profiles.match({ username: "ada" })).toBeNull();
    });

    it("counts a rating only where its library entry is visible to the viewer", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const linus = await signedInAs("Linus");
      await befriend(ada, grace);
      await finishAndRate(ada, ids.matrix, 36);
      await finishAndRate(ada, ids.hades, 36);
      await finishAndRate(ada, ids.show, 36, "friends");
      await finishAndRate(ada, ids.dune, 0, "private");
      for (const viewer of [grace, linus]) {
        for (const mediaId of [ids.matrix, ids.hades, ids.show, ids.dune]) {
          await viewer.caller.ratings.save({ target: { mediaId }, value: 36 });
        }
      }

      // The friend shares three visible titles; the private one, rated far apart, never counts.
      expect(await grace.caller.profiles.match({ username: "ada" })).toMatchObject({
        percent: 100,
        shared: 3,
      });
      // A stranger sees two, which is too few to compare.
      expect(await linus.caller.profiles.match({ username: "ada" })).toBeNull();
    });

    it("counts the viewer's own ratings whatever the visibility of their own library", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      for (const mediaId of [ids.matrix, ids.hades, ids.show]) {
        await finishAndRate(ada, mediaId, 36);
        await finishAndRate(grace, mediaId, 36, "private");
      }

      expect(await grace.caller.profiles.match({ username: "ada" })).toMatchObject({ shared: 3 });
      // Ada cannot see Grace's private entries, so from her side there is nothing to compare.
      expect(await ada.caller.profiles.match({ username: "grace" })).toBeNull();
    });
  });

  describe("how the viewer stands with a list of people", () => {
    it("says who the viewer follows and who follows them back", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const linus = await signedInAs("Linus");
      await signedInAs("Marie");
      await befriend(ada, grace);
      await linus.caller.follows.follow({ username: "ada" });
      await ada.caller.follows.follow({ username: "marie" });

      const relations = await ada.caller.profiles.relations({
        usernames: ["GRACE", "linus", "marie", "ada", "nobody"],
      });

      expect(relations.following.sort()).toEqual(["grace", "marie"]);
      expect(relations.followedBy.sort()).toEqual(["grace", "linus"]);
    });

    it("answers only about the people asked for, and nothing to a visitor", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      await signedInAs("Linus");
      await befriend(ada, grace);

      expect(await ada.caller.profiles.relations({ usernames: ["linus"] })).toEqual({
        following: [],
        followedBy: [],
      });
      expect(await ada.caller.profiles.relations({ usernames: [] })).toEqual({
        following: [],
        followedBy: [],
      });
      expect(await anonymous.profiles.relations({ usernames: ["grace"] })).toEqual({
        following: [],
        followedBy: [],
      });
    });
  });
});

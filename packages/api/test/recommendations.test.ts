import { db } from "@yousiverse/db";
import {
  books,
  episodes,
  follows,
  media,
  movies,
  seasons,
  similarChecks,
  similarTitles,
  users,
} from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, usToday } from "../src/calendar/dates";
import { anonymous, signedInAs } from "./helpers";

type Caller = Awaited<ReturnType<typeof signedInAs>>["caller"];

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

const MATRIX = { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" } as const;
const SEVERANCE = {
  type: "tv",
  title: "Severance",
  provider: "tmdb",
  providerId: "95396",
} as const;
const HADES = { type: "game", title: "Hades", provider: "igdb", providerId: "113112" } as const;
const PIRANESI = {
  type: "book",
  title: "Piranesi",
  provider: "open_library",
  providerId: "OL20893680W",
} as const;

/** Rates a title out of 10. */
const rate = (caller: Caller, mediaId: string, outOfTen: number) =>
  caller.ratings.save({ target: { mediaId }, value: outOfTen * 4 });

describe("recommendations.forYou", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  it("requires signing in", async () => {
    await expect(anonymous.recommendations.forYou()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("has nothing to go on until something is rated 7 or higher", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(MATRIX), 6.75);

    expect(await caller.recommendations.forYou()).toEqual({
      rows: [],
      hasLikedTitles: false,
      incomplete: false,
    });
    expect(await db.select().from(similarChecks)).toHaveLength(0);
  });

  it("suggests titles like a liked movie, best match first", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(MATRIX), 7);

    const { rows, hasLikedTitles, incomplete } = await caller.recommendations.forYou();

    expect({ hasLikedTitles, incomplete }).toEqual({ hasLikedTitles: true, incomplete: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.seed).toEqual({
      mediaId: expect.any(String),
      type: "movie",
      providerId: "603",
      title: "The Matrix",
      releaseYear: null,
      posterUrl: null,
      backdropUrl: null,
      artHue: null,
      artSaturation: null,
      posterAspect: null,
      rating: 28,
      author: null,
    });
    expect(rows[0]?.titles).toHaveLength(6);
    expect(rows[0]?.titles[0]).toEqual({
      type: "movie",
      providerId: "604",
      title: "The Matrix Reloaded",
      releaseYear: 2003,
      posterUrl: expect.stringContaining("https://"),
      backdropUrl: expect.stringContaining("/w1280/"),
      average: null,
    });
  });

  it("gives a suggestion everyone's average once it is in the catalog and rated", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const alan = await signedInAs("Alan");
    await rate(ada.caller, await addTitle(MATRIX), 9);
    const reloadedId = await addTitle({
      type: "movie",
      title: "The Matrix Reloaded",
      provider: "tmdb",
      providerId: "604",
    });
    // A game that happens to share the movie's provider id must not lend it a rating.
    const gameId = await addTitle({
      type: "game",
      title: "Same id, another medium",
      provider: "igdb",
      providerId: "604",
    });
    await rate(grace.caller, reloadedId, 8);
    await rate(alan.caller, reloadedId, 7);
    await rate(grace.caller, gameId, 2);

    const { rows } = await ada.caller.recommendations.forYou();

    expect(rows[0]?.titles[0]).toMatchObject({ providerId: "604", average: 30 });
    expect(rows[0]?.titles[1]?.average).toBeNull();
  });

  it("covers every media type, with an author's other books standing in for similar books", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(SEVERANCE), 10);
    await rate(caller, await addTitle(HADES), 9);
    await rate(caller, await addTitle(PIRANESI), 8);

    const { rows } = await caller.recommendations.forYou();

    expect(rows.map((row) => row.seed.title)).toEqual(["Severance", "Hades", "Piranesi"]);
    // A show is drawn as a screen, so its suggestions carry a wide image. Games and books have none.
    expect(rows[0]?.titles[0]).toMatchObject({
      type: "tv",
      title: "Emergence",
      backdropUrl: expect.stringContaining("/w1280/"),
    });
    expect(rows[1]?.titles.every((game) => game.backdropUrl === null)).toBe(true);
    // Only a book's row is headed with its author.
    expect(rows.map((row) => row.seed.author)).toEqual([null, null, "Susanna Clarke"]);
    expect(rows[1]?.titles).toContainEqual(
      expect.objectContaining({ type: "game", title: "Hades II" }),
    );
    // Piranesi is by the same author, but it is the book the row is about.
    expect(rows[2]?.titles.map((book) => book.title)).toEqual([
      "Jonathan Strange and Mr. Norrell",
      "The Ladies of Grace Adieu and Other Stories",
      "Wood at Midwinter",
    ]);
  });

  it("leaves out what is already in the library or already rated", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(MATRIX), 9);
    const reloadedId = await addTitle({
      type: "movie",
      title: "The Matrix Reloaded",
      provider: "tmdb",
      providerId: "604",
    });
    const genisysId = await addTitle({
      type: "movie",
      title: "Terminator Genisys",
      provider: "tmdb",
      providerId: "87101",
    });
    await caller.library.save({ mediaId: reloadedId, status: "want" });
    await rate(caller, genisysId, 3);

    const { rows } = await caller.recommendations.forYou();

    const suggested = rows.flatMap((row) => row.titles.map((title) => title.providerId));
    expect(suggested).not.toContain("604");
    expect(suggested).not.toContain("87101");
    expect(suggested).toHaveLength(6);
  });

  it("ignores another person's library when deciding what to leave out", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await rate(ada.caller, await addTitle(MATRIX), 9);
    const reloadedId = await addTitle({
      type: "movie",
      title: "The Matrix Reloaded",
      provider: "tmdb",
      providerId: "604",
    });
    await grace.caller.library.save({ mediaId: reloadedId, status: "finished" });

    const { rows } = await ada.caller.recommendations.forYou();

    expect(rows[0]?.titles[0]).toMatchObject({ providerId: "604" });
    expect((await grace.caller.recommendations.forYou()).rows).toEqual([]);
  });

  it("does not count a rating of one episode as liking the show", async () => {
    const { caller } = await signedInAs("Ada");
    await addTitle(SEVERANCE);
    const show = await caller.media.tvShow({ providerId: "95396" });
    const season = await caller.media.season({ providerId: "95396", seasonNumber: 1 });
    const episodeId = season.episodes[0]?.id ?? "";
    await caller.ratings.save({ target: { episodeId }, value: 40 });

    expect(await caller.recommendations.forYou()).toMatchObject({
      rows: [],
      hasLikedTitles: false,
    });
    expect(show.title).toBe("Severance");
  });

  it("shows a title once even when two liked titles lead to it", async () => {
    const { caller } = await signedInAs("Ada");
    const matrixId = await addTitle(MATRIX);
    const severanceId = await addTitle(SEVERANCE);
    await rate(caller, matrixId, 10);
    await rate(caller, severanceId, 9);
    await caller.recommendations.forYou();
    // Make the show's only similar title the movie's first suggestion.
    await db.delete(similarTitles).where(eq(similarTitles.mediaId, severanceId));
    await db.insert(similarTitles).values({
      mediaId: severanceId,
      position: 0,
      type: "movie",
      providerId: "604",
      title: "The Matrix Reloaded",
    });

    const { rows } = await caller.recommendations.forYou();

    expect(rows.map((row) => row.seed.title)).toEqual(["The Matrix"]);
    expect(rows[0]?.titles[0]).toMatchObject({ providerId: "604" });
  });

  it("keeps a title's similar titles for a month instead of asking again", async () => {
    const { caller } = await signedInAs("Ada");
    const matrixId = await addTitle(MATRIX);
    await rate(caller, matrixId, 8);
    await caller.recommendations.forYou();
    await db.delete(similarTitles);

    expect((await caller.recommendations.forYou()).rows).toEqual([]);

    await db
      .update(similarChecks)
      .set({ checkedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(similarChecks.mediaId, matrixId));
    expect((await caller.recommendations.forYou()).rows).toHaveLength(1);
  });

  it("treats a title its provider does not know as having nothing similar", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(
      caller,
      await addTitle({
        type: "movie",
        title: "Unknown",
        provider: "tmdb",
        providerId: "999999999",
      }),
      9,
    );

    expect(await caller.recommendations.forYou()).toEqual({
      rows: [],
      hasLikedTitles: true,
      incomplete: false,
    });
    expect(await db.select().from(similarChecks)).toHaveLength(1);
  });

  it("says so when a provider cannot be reached, and still shows the rest", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(MATRIX), 9);
    // No response is recorded for this title, which is how tests stand in for an outage.
    await rate(
      caller,
      await addTitle({ type: "movie", title: "Offline", provider: "tmdb", providerId: "424242" }),
      10,
    );

    const { rows, incomplete } = await caller.recommendations.forYou();

    expect(incomplete).toBe(true);
    expect(rows.map((row) => row.seed.title)).toEqual(["The Matrix"]);
  });
});

const today = usToday();
const inDays = (days: number) => addDays(today, days);
let nextId = 700_000;

async function addMovie(title: string, runtimeMinutes: number | null, releaseDate = inDays(-30)) {
  const mediaId = await addTitle({
    type: "movie",
    title,
    releaseDate,
    provider: "tmdb",
    providerId: String(nextId++),
  });
  await db.insert(movies).values({ mediaId, runtimeMinutes });
  return mediaId;
}

async function addBook(title: string, pageCount: number | null) {
  const mediaId = await addTitle({
    type: "book",
    title,
    provider: "open_library",
    providerId: `OL${nextId++}W`,
  });
  await db.insert(books).values({ mediaId, pageCount });
  return mediaId;
}

type Episode = { runtimeMinutes: number | null; airDate?: string | null };

/** A show whose seasons hold the given episodes, numbered from 1. Returns the episodes' ids too. */
async function addShow(title: string, seasonsOfEpisodes: Record<number, Episode[]>) {
  const mediaId = await addTitle({
    type: "tv",
    title,
    provider: "tmdb",
    providerId: String(nextId++),
  });
  const episodeIds: string[] = [];
  for (const [seasonNumber, inSeason] of Object.entries(seasonsOfEpisodes)) {
    const [season] = await db
      .insert(seasons)
      .values({ mediaId, seasonNumber: Number(seasonNumber), name: `Season ${seasonNumber}` })
      .returning({ id: seasons.id });
    const saved = await db
      .insert(episodes)
      .values(
        inSeason.map((episode, index) => ({
          seasonId: season?.id ?? "",
          episodeNumber: index + 1,
          name: `Episode ${index + 1}`,
          airDate: episode.airDate === undefined ? inDays(-60) : episode.airDate,
          runtimeMinutes: episode.runtimeMinutes,
        })),
      )
      .returning({ id: episodes.id });
    episodeIds.push(...saved.map((episode) => episode.id));
  }
  return { mediaId, episodeIds };
}

const minutes = (runtimeMinutes: number): Episode => ({ runtimeMinutes });

describe("recommendations.forTime", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  const titlesFor = async (caller: Caller, budget: "hour" | "two" | "evening" | "weekend") =>
    (await caller.recommendations.forTime({ budget })).picks.map((pick) => pick.title);

  it("requires signing in", async () => {
    await expect(anonymous.recommendations.forTime({ budget: "hour" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("fits wanted films by their length, leaving out what is unreleased or of unknown length", async () => {
    const { caller } = await signedInAs("Ada");
    const want = (mediaId: string) => caller.library.save({ mediaId, status: "want" });
    await want(await addMovie("Short", 60));
    await want(await addMovie("Feature", 125));
    await want(await addMovie("Long", 190));
    await want(await addMovie("Epic", 206));
    await want(await addMovie("Not out yet", 100, inDays(20)));
    await want(await addMovie("No length", null));
    await caller.library.save({ mediaId: await addMovie("Seen", 90), status: "finished" });
    await caller.library.save({ mediaId: await addMovie("Gave up", 90), status: "dropped" });
    await addMovie("Nobody's", 90);

    expect(await titlesFor(caller, "hour")).toEqual(["Short"]);
    expect((await titlesFor(caller, "two")).sort()).toEqual(["Feature", "Short"]);
    expect((await titlesFor(caller, "evening")).sort()).toEqual(["Feature", "Long", "Short"]);
    // A weekend is for what an evening cannot hold.
    expect(await titlesFor(caller, "weekend")).toEqual(["Epic"]);

    const { picks, pagesPerHour } = await caller.recommendations.forTime({ budget: "hour" });
    expect(pagesPerHour).toBe(40);
    expect(picks).toEqual([
      {
        mediaId: expect.any(String),
        type: "movie",
        providerId: expect.any(String),
        title: "Short",
        releaseYear: null,
        posterUrl: null,
        backdropUrl: null,
        artHue: null,
        artSaturation: null,
        posterAspect: null,
        status: "want",
        fit: { kind: "movie", minutes: 60 },
      },
    ]);
  });

  it("fits a show by as many of its next episodes as the time holds", async () => {
    const { caller } = await signedInAs("Ada");
    const drama = await addShow("Drama", {
      0: [minutes(10)],
      1: [minutes(50), minutes(55)],
      2: [minutes(52), minutes(58), minutes(61), { runtimeMinutes: 60, airDate: inDays(3) }],
    });
    // The special and the first three episodes: the next one is season 2, episode 2.
    for (const episodeId of drama.episodeIds.slice(0, 4)) {
      await caller.library.setWatched({ episodeId, watched: true });
    }
    const sitcom = await addShow("Sitcom", { 1: [minutes(22), minutes(24), minutes(23)] });
    await caller.library.save({ mediaId: sitcom.mediaId, status: "want" });

    const fits = async (budget: "hour" | "two" | "evening" | "weekend") =>
      (await caller.recommendations.forTime({ budget })).picks.map((pick) => [
        pick.title,
        pick.status,
        pick.fit,
      ]);

    expect(await fits("hour")).toEqual([
      [
        "Drama",
        "in_progress",
        { kind: "episodes", seasonNumber: 2, episodeNumber: 2, count: 1, minutes: 58 },
      ],
      [
        "Sitcom",
        "want",
        { kind: "episodes", seasonNumber: 1, episodeNumber: 1, count: 2, minutes: 46 },
      ],
    ]);
    // Two aired episodes are left of the drama; the third has not aired, so the run stops there.
    expect(await fits("two")).toEqual([
      [
        "Drama",
        "in_progress",
        { kind: "episodes", seasonNumber: 2, episodeNumber: 2, count: 2, minutes: 119 },
      ],
      [
        "Sitcom",
        "want",
        { kind: "episodes", seasonNumber: 1, episodeNumber: 1, count: 3, minutes: 69 },
      ],
    ]);
    // Neither has more left than an evening holds.
    expect(await fits("weekend")).toEqual([]);
  });

  it("leaves out a show whose next episode has not aired, has no length, or does not exist", async () => {
    const { caller } = await signedInAs("Ada");
    const want = (mediaId: string) => caller.library.save({ mediaId, status: "want" });
    await want(
      (await addShow("Not yet", { 1: [{ runtimeMinutes: 30, airDate: inDays(1) }] })).mediaId,
    );
    await want((await addShow("No date", { 1: [{ runtimeMinutes: 30, airDate: null }] })).mediaId);
    await want(
      (await addShow("No length", { 1: [{ runtimeMinutes: null }, minutes(30)] })).mediaId,
    );
    await want((await addShow("Only listed", {})).mediaId);
    await want((await addShow("Too long", { 1: [minutes(90)] })).mediaId);
    const caughtUp = await addShow("Caught up", { 1: [minutes(30)] });
    await caller.library.setWatched({ episodeId: caughtUp.episodeIds[0] ?? "", watched: true });

    expect(await titlesFor(caller, "hour")).toEqual([]);
    expect(await titlesFor(caller, "two")).toEqual(["Too long"]);
  });

  it("fits a book by the pages left at 40 pages an hour", async () => {
    const { caller } = await signedInAs("Ada");
    const novella = await addBook("Novella", 80);
    const novel = await addBook("Novel", 400);
    const tome = await addBook("Tome", 900);
    const unknown = await addBook("No page count", null);
    const done = await addBook("Read to the end", 300);
    for (const mediaId of [novella, novel, tome, unknown, done]) {
      await caller.library.save({ mediaId, status: "want" });
    }
    await caller.library.setProgress({ mediaId: done, pagesRead: 300 });

    // 80 pages are two hours of reading; 400 are ten; 900 are more than a weekend.
    expect(await titlesFor(caller, "hour")).toEqual([]);
    expect(await titlesFor(caller, "two")).toEqual(["Novella"]);
    expect(await titlesFor(caller, "weekend")).toEqual(["Novel"]);

    await caller.library.save({ mediaId: tome, status: "in_progress" });
    await caller.library.setProgress({ mediaId: tome, pagesRead: 860 });
    const { picks } = await caller.recommendations.forTime({ budget: "hour" });
    expect(picks.map((pick) => [pick.title, pick.fit])).toEqual([
      ["Tome", { kind: "pages", pages: 40, started: true }],
    ]);
    const twoHours = await caller.recommendations.forTime({ budget: "two" });
    expect(twoHours.picks.find((pick) => pick.title === "Novella")?.fit).toEqual({
      kind: "pages",
      pages: 80,
      started: false,
    });
  });

  it("puts what is under way first, leaves games out, and reads only the asker's library", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const film = await addMovie("A Film", 100);
    const book = await addBook("A Book", 60);
    const game = await addTitle({
      type: "game",
      title: "A Game",
      provider: "igdb",
      providerId: "77",
    });
    await ada.caller.library.save({ mediaId: book, status: "in_progress" });
    await ada.caller.library.save({ mediaId: game, status: "in_progress" });
    await ada.caller.library.save({ mediaId: film, status: "want" });
    await grace.caller.library.save({ mediaId: await addMovie("Grace's", 100), status: "want" });

    expect(await titlesFor(ada.caller, "two")).toEqual(["A Book", "A Film"]);
    expect(await titlesFor(grace.caller, "two")).toEqual(["Grace's"]);
  });
});

describe("recommendations.companions and forTwo", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  const film = (title: string) =>
    addTitle({ type: "movie", title, provider: "tmdb", providerId: String(nextId++) });

  const reasonsFor = async (caller: Caller, username: string) =>
    (await caller.recommendations.forTwo({ username })).map((pick) => [
      pick.title,
      pick.reason,
      pick.rating,
    ]);

  it("lists the people someone follows who have a username, friends first, then most recent", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const alan = await signedInAs("Alan");
    const nameless = await signedInAs("Nameless", { username: false });
    await signedInAs("Edsger");
    await signedInAs("Stranger");
    for (const username of ["grace", "alan", "edsger"]) {
      await ada.caller.follows.follow({ username });
    }
    await db.insert(follows).values({ followerId: ada.user.id, followedId: nameless.user.id });

    expect(await ada.caller.recommendations.companions()).toEqual([
      { username: "edsger" },
      { username: "alan" },
      { username: "grace" },
    ]);

    // Grace follows back, which makes her a friend. Someone who only follows Ada is not listed.
    await grace.caller.follows.follow({ username: "ada" });
    await nameless.caller.follows.follow({ username: "ada" });
    expect(await ada.caller.recommendations.companions()).toEqual([
      { username: "grace" },
      { username: "edsger" },
      { username: "alan" },
    ]);
    expect(await alan.caller.recommendations.companions()).toEqual([]);
    await expect(anonymous.recommendations.companions()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("explains each pick, strongest reason first", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const [loved, liked, bothWant, adasFavorite, gracesFavorite, gracesGood, meh, seen] =
      await Promise.all(
        [
          "Loved",
          "Liked",
          "Both want",
          "Ada's favorite",
          "Grace's favorite",
          "Good",
          "Meh",
          "Seen",
        ].map(film),
      );
    const ids = { loved, liked, bothWant, adasFavorite, gracesFavorite, gracesGood, meh, seen };
    const mediaId = (key: keyof typeof ids) => ids[key] ?? "";

    // Ada wants three of them, and has seen and rated two.
    for (const key of ["loved", "liked", "bothWant", "meh"] as const) {
      await ada.caller.library.save({ mediaId: mediaId(key), status: "want" });
    }
    await ada.caller.library.save({ mediaId: mediaId("adasFavorite"), status: "finished" });
    await rate(ada.caller, mediaId("adasFavorite"), 9);
    await ada.caller.library.save({ mediaId: mediaId("seen"), status: "finished" });

    // Grace has seen and rated most of them, and wants two.
    for (const [key, outOfTen] of [
      ["loved", 9.5],
      ["liked", 8],
      ["meh", 7.75],
      ["gracesFavorite", 8.5],
      ["gracesGood", 8.25],
      ["seen", 10],
    ] as const) {
      await grace.caller.library.save({ mediaId: mediaId(key), status: "finished" });
      await rate(grace.caller, mediaId(key), outOfTen);
    }
    await grace.caller.library.save({ mediaId: mediaId("bothWant"), status: "want" });
    await grace.caller.library.save({ mediaId: mediaId("adasFavorite"), status: "want" });

    expect(await reasonsFor(ada.caller, "grace")).toEqual([
      ["Loved", "you_want_they_rated", 38],
      ["Liked", "you_want_they_rated", 32],
      ["Both want", "both_want", null],
      ["Ada's favorite", "you_rated_they_want", 36],
      // Not in Ada's library at all, and a favorite of Grace's. 8.25 is not enough for that,
      // and what Ada has already seen is not suggested back to her.
      ["Grace's favorite", "they_rated", 34],
    ]);

    const [first] = await ada.caller.recommendations.forTwo({ username: "grace" });
    expect(first).toEqual({
      mediaId: mediaId("loved"),
      type: "movie",
      providerId: expect.any(String),
      title: "Loved",
      releaseYear: null,
      posterUrl: null,
      backdropUrl: null,
      artHue: null,
      artSaturation: null,
      posterAspect: null,
      reason: "you_want_they_rated",
      rating: 38,
    });
  });

  it("uses only the entries the other person lets the viewer see", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const [open, forFriends, secret] = await Promise.all(
      ["Open", "For friends", "Secret"].map(film),
    );
    for (const [mediaId, visibility] of [
      [open, "public"],
      [forFriends, "friends"],
      [secret, "private"],
    ] as const) {
      await ada.caller.library.save({ mediaId: mediaId ?? "", status: "want" });
      await grace.caller.library.save({ mediaId: mediaId ?? "", status: "finished", visibility });
      await rate(grace.caller, mediaId ?? "", 9);
    }

    // Ada follows Grace, but Grace does not follow back: they are not friends.
    await ada.caller.follows.follow({ username: "grace" });
    expect(await reasonsFor(ada.caller, "grace")).toEqual([["Open", "you_want_they_rated", 36]]);

    await grace.caller.follows.follow({ username: "ada" });
    expect(await reasonsFor(ada.caller, "grace")).toEqual([
      ["For friends", "you_want_they_rated", 36],
      ["Open", "you_want_they_rated", 36],
    ]);
  });

  it("does not credit a rating whose title is not in the other person's library", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const rated = await film("Rated only");
    await ada.caller.library.save({ mediaId: rated, status: "want" });
    await rate(grace.caller, rated, 10);

    expect(await reasonsFor(ada.caller, "grace")).toEqual([]);
  });

  it("needs signing in, a person who exists, and someone other than the asker", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(anonymous.recommendations.forTwo({ username: "ada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.recommendations.forTwo({ username: "nobody" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.recommendations.forTwo({ username: "ada" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

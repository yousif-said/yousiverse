import { db } from "@yousiverse/db";
import { books, episodes, media, seasons, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

const missingId = "00000000-0000-4000-8000-000000000000";

/** A book with a page count, a game, and a show with two seasons and a special. */
async function addTitles() {
  const [book, game, show, movie] = await db
    .insert(media)
    .values([
      { type: "book", title: "Piranesi", provider: "open_library", providerId: "OL20893680W" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112", releaseYear: 2020 },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396", releaseYear: 2022 },
      {
        type: "movie",
        title: "The Matrix",
        provider: "tmdb",
        providerId: "603",
        releaseYear: 1999,
      },
    ])
    .returning({ id: media.id });
  if (!book || !game || !show || !movie) throw new Error("Titles were not created.");
  await db.insert(books).values({ mediaId: book.id, authors: ["Susanna Clarke"], pageCount: 272 });

  const [specials, first, second] = await db
    .insert(seasons)
    .values([
      { mediaId: show.id, seasonNumber: 0, name: "Specials" },
      { mediaId: show.id, seasonNumber: 1, name: "Season 1" },
      { mediaId: show.id, seasonNumber: 2, name: "Season 2" },
    ])
    .returning({ id: seasons.id });
  if (!specials || !first || !second) throw new Error("Seasons were not created.");
  const created = await db
    .insert(episodes)
    .values([
      { seasonId: specials.id, episodeNumber: 1, name: "Behind the Scenes" },
      { seasonId: first.id, episodeNumber: 1, name: "Good News About Hell", airDate: "2022-02-18" },
      { seasonId: first.id, episodeNumber: 2, name: "Half Loop", airDate: "2022-02-18" },
      { seasonId: second.id, episodeNumber: 1, name: "Hello, Ms. Cobel", airDate: "2025-01-17" },
    ])
    .returning({ id: episodes.id });
  const [special, s1e1, s1e2, s2e1] = created.map((episode) => episode.id) as [
    string,
    string,
    string,
    string,
  ];
  return {
    book: book.id,
    game: game.id,
    show: show.id,
    movie: movie.id,
    special,
    s1e1,
    s1e2,
    s2e1,
  };
}

describe("library progress", () => {
  let ids: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    ids = await addTitles();
  });

  it("requires signing in", async () => {
    await expect(
      anonymous.library.setWatched({ episodeId: ids.s1e1, watched: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymous.library.setProgress({ mediaId: ids.book, pagesRead: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.library.statuses({ mediaIds: [ids.book] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("records the page a person is on, against the book's length", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: ids.book, status: "in_progress" });

    await caller.library.setProgress({ mediaId: ids.book, pagesRead: 141 });

    expect((await caller.library.entry({ mediaId: ids.book }))?.progress).toEqual({
      kind: "pages",
      read: 141,
      of: 272,
    });
  });

  it("records minutes played, and clears progress when given null", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: ids.game, status: "in_progress" });

    await caller.library.setProgress({ mediaId: ids.game, minutesPlayed: 38 * 60 });
    expect((await caller.library.entry({ mediaId: ids.game }))?.progress).toEqual({
      kind: "minutes",
      played: 2280,
    });

    await caller.library.setProgress({ mediaId: ids.game, minutesPlayed: null });
    expect((await caller.library.entry({ mediaId: ids.game }))?.progress).toBeNull();
  });

  it("refuses progress on a title that is not in the library, and negative amounts", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.library.setProgress({ mediaId: ids.book, pagesRead: 10 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await caller.library.save({ mediaId: ids.book, status: "in_progress" });
    await expect(
      caller.library.setProgress({ mediaId: ids.book, pagesRead: -1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("puts a show in progress when its first episode is watched", async () => {
    const { caller } = await signedInAs("Ada");

    await caller.library.setWatched({ episodeId: ids.s1e1, watched: true });

    expect(await caller.library.entry({ mediaId: ids.show })).toMatchObject({
      status: "in_progress",
      visibility: "public",
    });
    expect(await caller.library.watchedEpisodes({ mediaId: ids.show })).toEqual([ids.s1e1]);
  });

  it("moves a wanted show to in progress, but leaves a finished or dropped one alone", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.show, status: "want", visibility: "private" });
    await ada.caller.library.setWatched({ episodeId: ids.s1e1, watched: true });
    expect(await ada.caller.library.entry({ mediaId: ids.show })).toMatchObject({
      status: "in_progress",
      visibility: "private",
    });

    const grace = await signedInAs("Grace");
    await grace.caller.library.save({ mediaId: ids.show, status: "dropped" });
    await grace.caller.library.setWatched({ episodeId: ids.s1e1, watched: true });
    expect((await grace.caller.library.entry({ mediaId: ids.show }))?.status).toBe("dropped");
  });

  it("says which episode is next, counting within its season and leaving out specials", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.setWatched({ episodeId: ids.special, watched: true });
    await caller.library.setWatched({ episodeId: ids.s1e1, watched: true });

    expect((await caller.library.entry({ mediaId: ids.show }))?.progress).toEqual({
      kind: "episodes",
      watched: 1,
      total: 3,
      next: {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Half Loop",
        airDate: "2022-02-18",
        inSeason: 2,
        watchedInSeason: 1,
      },
    });
  });

  it("has nothing next once every episode is watched, and forgets an episode unmarked", async () => {
    const { caller } = await signedInAs("Ada");
    for (const episodeId of [ids.s1e1, ids.s1e2, ids.s2e1]) {
      await caller.library.setWatched({ episodeId, watched: true });
    }
    expect((await caller.library.entry({ mediaId: ids.show }))?.progress).toMatchObject({
      watched: 3,
      total: 3,
      next: null,
    });

    await caller.library.setWatched({ episodeId: ids.s2e1, watched: false });
    await caller.library.setWatched({ episodeId: ids.s2e1, watched: false });

    expect((await caller.library.entry({ mediaId: ids.show }))?.progress).toMatchObject({
      watched: 2,
      next: { seasonNumber: 2, episodeNumber: 1 },
    });
  });

  it("keeps each person's watched episodes to themselves", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.library.setWatched({ episodeId: ids.s1e1, watched: true });

    expect(await grace.caller.library.watchedEpisodes({ mediaId: ids.show })).toEqual([]);
    expect(await grace.caller.library.entry({ mediaId: ids.show })).toBeNull();
  });

  it("refuses to mark an episode that does not exist", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.library.setWatched({ episodeId: missingId, watched: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("adds several titles at once without touching ones already there", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: ids.movie, status: "finished", visibility: "private" });

    const result = await caller.library.saveMany({
      mediaIds: [ids.movie, ids.book, ids.game, missingId],
      status: "want",
    });

    expect(result).toEqual({ added: 2 });
    expect(await caller.library.entry({ mediaId: ids.movie })).toMatchObject({
      status: "finished",
      visibility: "private",
    });
    const statuses = await caller.library.statuses({
      mediaIds: [ids.movie, ids.book, ids.game, ids.show],
    });
    expect(new Map(statuses.map((entry) => [entry.mediaId, entry.status]))).toEqual(
      new Map([
        [ids.movie, "finished"],
        [ids.book, "want"],
        [ids.game, "want"],
      ]),
    );
  });

  it("lists the library with counts for the whole of it, whatever the filter", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: ids.movie, status: "finished" });
    await caller.library.save({ mediaId: ids.game, status: "finished" });
    await caller.library.save({ mediaId: ids.book, status: "in_progress" });
    await caller.library.setProgress({ mediaId: ids.book, pagesRead: 20 });

    const list = await caller.library.list({ type: "book" });

    expect(list.entries).toMatchObject([
      { title: "Piranesi", status: "in_progress", progress: { kind: "pages", read: 20, of: 272 } },
    ]);
    expect(list.counts).toHaveLength(3);
    expect(list.counts).toEqual(
      expect.arrayContaining([
        { type: "movie", status: "finished", count: 1 },
        { type: "game", status: "finished", count: 1 },
        { type: "book", status: "in_progress", count: 1 },
      ]),
    );
  });

  it("sorts by the person's own rating, by title, and by year", async () => {
    const { caller } = await signedInAs("Ada");
    for (const mediaId of [ids.movie, ids.game, ids.show]) {
      await caller.library.save({ mediaId, status: "finished" });
    }
    await caller.ratings.save({ target: { mediaId: ids.game }, value: 38 });
    await caller.ratings.save({ target: { mediaId: ids.movie }, value: 36 });
    // An episode's rating is not the show's.
    await caller.ratings.save({ target: { episodeId: ids.s1e1 }, value: 40 });

    const titles = async (sort: "rating" | "title" | "year") =>
      (await caller.library.list({ sort })).entries.map((entry) => entry.title);

    expect(await titles("rating")).toEqual(["Hades", "The Matrix", "Severance"]);
    expect(await titles("title")).toEqual(["Hades", "Severance", "The Matrix"]);
    expect(await titles("year")).toEqual(["Severance", "Hades", "The Matrix"]);
    expect((await caller.library.list({ sort: "rating" })).entries[0]).toMatchObject({
      rating: 38,
    });
  });
});

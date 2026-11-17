import { db } from "@yousiverse/db";
import { episodes, libraryEntries, lists, media, seasons, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

async function addTitles() {
  const [matrix, hades, show] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !show) throw new Error("Titles were not created.");
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
  return { matrix: matrix.id, hades: hades.id, show: show.id, episode: episode.id };
}

describe("feed.following", () => {
  let ids: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    ids = await addTitles();
  });

  it("requires signing in", async () => {
    await expect(anonymous.feed.following()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("is empty, and says so, for someone who follows nobody", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await grace.caller.library.save({ mediaId: ids.matrix, status: "finished" });

    expect(await ada.caller.feed.following()).toEqual({
      followedCount: 0,
      items: [],
      olderThan: null,
    });
  });

  it("shows what followed people added, reviewed, and listed, newest first", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });

    await grace.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await grace.caller.ratings.save({ target: { mediaId: ids.matrix }, value: 36 });
    await grace.caller.reviews.save({ target: { episodeId: ids.episode }, body: "Tense." });
    await grace.caller.lists.create({ name: "Weekend" });

    const feed = await ada.caller.feed.following();

    expect(feed.followedCount).toBe(1);
    expect(feed.items).toMatchObject([
      { kind: "list", username: "grace", name: "Weekend" },
      {
        kind: "review",
        username: "grace",
        title: "Severance",
        body: "Tense.",
        episode: { name: "Half Loop", seasonNumber: 1, episodeNumber: 2 },
      },
      {
        kind: "library",
        username: "grace",
        title: "The Matrix",
        status: "finished",
        rating: 36,
        providerId: "603",
      },
    ]);
  });

  it("shows 40 items at a time and pages back through older activity without gaps", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });
    const start = Date.parse("2026-03-01T12:00:00Z");
    await db.insert(lists).values(
      Array.from({ length: 45 }, (_, index) => ({
        userId: grace.user.id,
        name: `List ${index + 1}`,
        createdAt: new Date(start + index * 60_000),
      })),
    );
    await grace.caller.library.save({ mediaId: ids.matrix, status: "want" });

    const first = await ada.caller.feed.following();
    expect(first.items).toHaveLength(40);
    expect(first.items[0]).toMatchObject({ kind: "library", title: "The Matrix" });
    expect(first.items[1]).toMatchObject({ kind: "list", name: "List 45" });
    expect(first.items.at(-1)).toMatchObject({ name: "List 7" });
    expect(first.olderThan).toBe(new Date(start + 6 * 60_000).toISOString());

    const second = await ada.caller.feed.following({ before: first.olderThan ?? undefined });
    expect(second.items.map((item) => (item.kind === "list" ? item.name : item.kind))).toEqual([
      "List 6",
      "List 5",
      "List 4",
      "List 3",
      "List 2",
      "List 1",
    ]);
    expect(second.olderThan).toBeNull();
  });

  it("refuses a page marker that is not a moment in time", async () => {
    const ada = await signedInAs("Ada");

    await expect(ada.caller.feed.following({ before: "yesterday" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("leaves out people the viewer does not follow, and the viewer's own activity", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    await ada.caller.follows.follow({ username: "grace" });
    // Linus follows Ada, which does not put his activity in her feed.
    await linus.caller.follows.follow({ username: "ada" });

    await ada.caller.library.save({ mediaId: ids.matrix, status: "want" });
    await linus.caller.library.save({ mediaId: ids.matrix, status: "want" });
    await grace.caller.library.save({ mediaId: ids.hades, status: "in_progress" });

    const { items } = await ada.caller.feed.following();
    expect(items).toMatchObject([{ kind: "library", username: "grace", title: "Hades" }]);
  });

  it("shows friends-only activity to friends and never shows private activity", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });
    await grace.caller.library.save({
      mediaId: ids.matrix,
      status: "finished",
      visibility: "friends",
    });
    await grace.caller.reviews.save({
      target: { mediaId: ids.matrix },
      body: "For friends.",
      visibility: "friends",
    });
    await grace.caller.lists.create({ name: "Friends list", visibility: "friends" });
    await grace.caller.library.save({
      mediaId: ids.hades,
      status: "dropped",
      visibility: "private",
    });
    await grace.caller.reviews.save({
      target: { mediaId: ids.hades },
      body: "Secret.",
      visibility: "private",
    });
    await grace.caller.lists.create({ name: "Secret list", visibility: "private" });

    // Ada follows Grace, but Grace does not follow back: they are not friends.
    expect((await ada.caller.feed.following()).items).toEqual([]);

    await grace.caller.follows.follow({ username: "ada" });
    const kinds = (await ada.caller.feed.following()).items.map((item) => item.kind).sort();
    expect(kinds).toEqual(["library", "list", "review"]);
    expect(JSON.stringify(await ada.caller.feed.following())).not.toContain("Secret");
  });

  it("does not reveal a rating for a title whose library entry is hidden", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });
    await grace.caller.library.save({
      mediaId: ids.hades,
      status: "finished",
      visibility: "private",
    });
    await grace.caller.ratings.save({ target: { mediaId: ids.hades }, value: 12 });

    expect((await ada.caller.feed.following()).items).toEqual([]);
  });

  it("orders by when each thing happened", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });
    await grace.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await grace.caller.library.save({ mediaId: ids.hades, status: "want" });
    await db
      .update(libraryEntries)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(libraryEntries.mediaId, ids.hades));

    const titles = (await ada.caller.feed.following()).items.map((item) =>
      item.kind === "library" ? item.title : null,
    );
    expect(titles).toEqual(["The Matrix", "Hades"]);
  });
});

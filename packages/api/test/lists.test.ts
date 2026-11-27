import { db } from "@yousiverse/db";
import { media, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

async function addTitles() {
  const [matrix, hades, dune, piranesi, severance] = await db
    .insert(media)
    .values([
      {
        type: "movie",
        title: "The Matrix",
        provider: "tmdb",
        providerId: "603",
        releaseYear: 1999,
        posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/original/matrix-wide.jpg",
        artHue: 140,
        artSaturation: 60,
      },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "book", title: "Dune", provider: "open_library", providerId: "OL893414W" },
      { type: "book", title: "Piranesi", provider: "open_library", providerId: "OL20893680W" },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !dune || !piranesi || !severance) {
    throw new Error("Titles were not created.");
  }
  return {
    matrix: matrix.id,
    hades: hades.id,
    dune: dune.id,
    piranesi: piranesi.id,
    severance: severance.id,
  };
}

const missingId = "00000000-0000-4000-8000-000000000000";

describe("lists", () => {
  let titles: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    titles = await addTitles();
  });

  it("requires signing in to make a list", async () => {
    await expect(anonymous.lists.create({ name: "Favorites" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(anonymous.lists.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a public list that anyone can open", async () => {
    const { caller } = await signedInAs("Ada");

    const { id } = await caller.lists.create({ name: "  Comfort rewatches ", description: "" });

    expect(await anonymous.lists.get({ id })).toEqual({
      id,
      name: "Comfort rewatches",
      description: null,
      visibility: "public",
      owner: "ada",
      isOwner: false,
      items: [],
    });
    expect(await caller.lists.get({ id })).toMatchObject({ isOwner: true });
  });

  it("rejects a list with no name", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(caller.lists.create({ name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("holds titles of different types in the order they were added, without repeats", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });

    await caller.lists.addItem({ listId: id, mediaId: titles.hades });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });
    await caller.lists.addItem({ listId: id, mediaId: titles.hades });

    const list = await caller.lists.get({ id });
    expect(list.items.map(({ type, title }) => ({ type, title }))).toEqual([
      { type: "game", title: "Hades" },
      { type: "movie", title: "The Matrix" },
    ]);
    expect(await caller.lists.mine()).toMatchObject([{ name: "Favorites", itemCount: 2 }]);
  });

  it("returns what is needed to draw each title, and its note", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix, note: "  Still the one. " });
    await caller.lists.addItem({ listId: id, mediaId: titles.hades });

    expect((await anonymous.lists.get({ id })).items).toEqual([
      {
        mediaId: titles.matrix,
        type: "movie",
        providerId: "603",
        title: "The Matrix",
        releaseYear: 1999,
        posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/original/matrix-wide.jpg",
        artHue: 140,
        artSaturation: 60,
        posterAspect: null,
        note: "Still the one.",
      },
      expect.objectContaining({ title: "Hades", note: null }),
    ]);
  });

  it("keeps the note a title already has when the title is added again", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix, note: "First thought." });

    await caller.lists.addItem({ listId: id, mediaId: titles.matrix, note: "Second thought." });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    expect((await caller.lists.get({ id })).items).toMatchObject([{ note: "First thought." }]);
  });

  it("writes, changes, and clears a note", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });
    const noteNow = async () => (await caller.lists.get({ id })).items[0]?.note;

    await caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: " Rewatch yearly. " });
    expect(await noteNow()).toBe("Rewatch yearly.");

    await caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: "Every spring." });
    expect(await noteNow()).toBe("Every spring.");

    await caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: null });
    expect(await noteNow()).toBeNull();

    // A note of nothing but spaces is no note.
    await caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: "   " });
    expect(await noteNow()).toBeNull();
  });

  it("refuses a note longer than 280 characters, or for a title that is not on the list", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });
    const tooLong = "x".repeat(281);

    await expect(
      caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: tooLong }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.lists.addItem({ listId: id, mediaId: titles.hades, note: tooLong }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.lists.setNote({ listId: id, mediaId: titles.hades, note: "Not here." }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: "x".repeat(280) });
  });

  it("shows each of a person's lists with its description and its first four titles", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites", description: "The best." });
    const empty = await caller.lists.create({ name: "Someday" });
    for (const mediaId of [
      titles.hades,
      titles.matrix,
      titles.dune,
      titles.piranesi,
      titles.severance,
    ]) {
      await caller.lists.addItem({ listId: id, mediaId });
    }

    const mine = await caller.lists.mine();

    expect(mine).toMatchObject([
      { id, name: "Favorites", description: "The best.", visibility: "public", itemCount: 5 },
      { id: empty.id, name: "Someday", description: null, itemCount: 0, artwork: [] },
    ]);
    expect(mine[0]?.artwork.map((title) => title.title)).toEqual([
      "Hades",
      "The Matrix",
      "Dune",
      "Piranesi",
    ]);
    expect(mine[0]?.artwork[1]).toEqual({
      mediaId: titles.matrix,
      type: "movie",
      providerId: "603",
      title: "The Matrix",
      releaseYear: 1999,
      posterUrl: "https://image.tmdb.org/t/p/original/matrix.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/original/matrix-wide.jpg",
      artHue: 140,
      artSaturation: 60,
      posterAspect: null,
    });
  });

  it("shows lists made by people the viewer follows, and by nobody else", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    await ada.caller.follows.follow({ username: "grace" });
    // Linus follows Ada, which does not show her his lists.
    await linus.caller.follows.follow({ username: "ada" });
    await ada.caller.lists.create({ name: "Ada's own" });
    await linus.caller.lists.create({ name: "Linus's list" });
    const { id } = await grace.caller.lists.create({ name: "Grace's list" });
    await grace.caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    expect(await ada.caller.lists.fromFollowing()).toMatchObject([
      {
        id,
        name: "Grace's list",
        owner: "grace",
        itemCount: 1,
        artwork: [{ title: "The Matrix", providerId: "603" }],
      },
    ]);
    expect(await grace.caller.lists.fromFollowing()).toEqual([]);
    await expect(anonymous.lists.fromFollowing()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps friends-only and private lists, and their titles, out of a follower's view", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });
    for (const visibility of ["friends", "private"] as const) {
      const { id } = await grace.caller.lists.create({ name: `${visibility} list`, visibility });
      await grace.caller.lists.addItem({ listId: id, mediaId: titles.matrix });
    }

    // Ada follows Grace, but Grace does not follow back: they are not friends.
    expect(await ada.caller.lists.fromFollowing()).toEqual([]);

    await grace.caller.follows.follow({ username: "ada" });
    const seen = await ada.caller.lists.fromFollowing();
    expect(seen).toMatchObject([{ name: "friends list", artwork: [{ title: "The Matrix" }] }]);
    expect(JSON.stringify(seen)).not.toContain("private list");
  });

  it("takes a title off a list", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.hades });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    await caller.lists.removeItem({ listId: id, mediaId: titles.hades });

    expect((await caller.lists.get({ id })).items.map((item) => item.title)).toEqual([
      "The Matrix",
    ]);
  });

  it("says which of a person's lists hold a title", async () => {
    const { caller } = await signedInAs("Ada");
    const favorites = await caller.lists.create({ name: "Favorites" });
    await caller.lists.create({ name: "Backlog" });
    await caller.lists.addItem({ listId: favorites.id, mediaId: titles.matrix });

    expect(await caller.lists.forTitle({ mediaId: titles.matrix })).toMatchObject([
      { name: "Backlog", contains: false },
      { name: "Favorites", contains: true },
    ]);
    expect(await caller.lists.forTitle({ mediaId: titles.hades })).toMatchObject([
      { name: "Backlog", contains: false },
      { name: "Favorites", contains: false },
    ]);
  });

  it("refuses to add a title that is not in the catalog", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });

    await expect(caller.lists.addItem({ listId: id, mediaId: missingId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("shows a private list only to its owner", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.lists.create({
      name: "Guilty pleasures",
      visibility: "private",
    });
    await ada.caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    expect(await ada.caller.lists.get({ id })).toMatchObject({
      visibility: "private",
      isOwner: true,
    });
    await expect(grace.caller.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(anonymous.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides a public list once its owner makes it private", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });

    await caller.lists.update({ id, name: "Favorites", visibility: "private" });

    await expect(anonymous.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("renames a list and keeps who can see it", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favs", visibility: "private" });

    await caller.lists.update({ id, name: "Favorites", description: "The best of the best." });

    expect(await caller.lists.get({ id })).toMatchObject({
      name: "Favorites",
      description: "The best of the best.",
      visibility: "private",
    });
  });

  it("lets nobody but the owner change or delete a list", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.lists.create({ name: "Favorites" });
    await ada.caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    await expect(grace.caller.lists.update({ id, name: "Hijacked" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      grace.caller.lists.addItem({ listId: id, mediaId: titles.hades }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      grace.caller.lists.removeItem({ listId: id, mediaId: titles.matrix }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      grace.caller.lists.setNote({ listId: id, mediaId: titles.matrix, note: "Hijacked" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      anonymous.lists.setNote({ listId: id, mediaId: titles.matrix, note: "Hijacked" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await grace.caller.lists.remove({ id });

    expect(await ada.caller.lists.get({ id })).toMatchObject({
      name: "Favorites",
      items: [{ title: "The Matrix", note: null }],
    });
    expect(await grace.caller.lists.mine()).toEqual([]);
  });

  it("deletes a list along with what was on it", async () => {
    const { caller } = await signedInAs("Ada");
    const { id } = await caller.lists.create({ name: "Favorites" });
    await caller.lists.addItem({ listId: id, mediaId: titles.matrix });

    await caller.lists.remove({ id });

    await expect(caller.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await caller.lists.forTitle({ mediaId: titles.matrix })).toEqual([]);
  });
});

import { db } from "@yousiverse/db";
import { media, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

type Caller = Awaited<ReturnType<typeof signedInAs>>["caller"] | typeof anonymous;

/**
 * Ada owns one thing of each kind at each visibility. Grace and Ada follow each other, so they
 * are friends. Linus follows Ada, and Ada follows Marie, but neither is followed back.
 */
async function setUp() {
  const [matrix, hades, dune] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "book", title: "Dune", provider: "open_library", providerId: "OL893414W" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !dune) throw new Error("Titles were not created.");

  const ada = await signedInAs("Ada");
  const grace = await signedInAs("Grace");
  const linus = await signedInAs("Linus");
  const marie = await signedInAs("Marie");
  await ada.caller.follows.follow({ username: "grace" });
  await grace.caller.follows.follow({ username: "ada" });
  await linus.caller.follows.follow({ username: "ada" });
  await ada.caller.follows.follow({ username: "marie" });

  const levels = [
    { visibility: "public", mediaId: matrix.id },
    { visibility: "friends", mediaId: hades.id },
    { visibility: "private", mediaId: dune.id },
  ] as const;
  const listIds: Record<string, string> = {};
  for (const { visibility, mediaId } of levels) {
    await ada.caller.library.save({ mediaId, status: "finished", visibility });
    await ada.caller.reviews.save({
      target: { mediaId },
      body: `${visibility} review`,
      visibility,
    });
    const list = await ada.caller.lists.create({ name: `${visibility} list`, visibility });
    listIds[visibility] = list.id;
  }
  return { ada, grace, linus, marie, listIds, titles: { matrix, hades, dune } };
}

describe("friends-only visibility", () => {
  let world: Awaited<ReturnType<typeof setUp>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    world = await setUp();
  });

  const seenOnProfile = async (caller: Caller) => ({
    library: (await caller.profiles.library({ username: "ada" }))
      .map((entry) => entry.title)
      .sort(),
    lists: (await caller.profiles.lists({ username: "ada" })).map((list) => list.name).sort(),
    reviews: (await caller.profiles.reviews({ username: "ada" }))
      .map((review) => review.body)
      .sort(),
  });
  const PUBLIC_ONLY = {
    library: ["The Matrix"],
    lists: ["public list"],
    reviews: ["public review"],
  };

  it("shows a friend the public and friends-only parts of a profile, never the private part", async () => {
    expect(await seenOnProfile(world.grace.caller)).toEqual({
      library: ["Hades", "The Matrix"],
      lists: ["friends list", "public list"],
      reviews: ["friends review", "public review"],
    });
  });

  it("shows only the public part to people who are not friends", async () => {
    // A stranger, someone who follows the owner, and someone the owner follows.
    for (const caller of [anonymous, world.linus.caller, world.marie.caller]) {
      expect(await seenOnProfile(caller)).toEqual(PUBLIC_ONLY);
    }
  });

  it("shows the owner their own profile as the public sees it", async () => {
    expect(await seenOnProfile(world.ada.caller)).toEqual(PUBLIC_ONLY);
  });

  it("stops showing friends-only content once either person unfollows", async () => {
    await world.ada.caller.follows.unfollow({ username: "grace" });

    expect(await seenOnProfile(world.grace.caller)).toEqual(PUBLIC_ONLY);
  });

  it("lists a friends-only review on the title's page for friends alone", async () => {
    const target = { mediaId: world.titles.hades.id };
    const others = async (caller: Caller) =>
      (await caller.reviews.list({ target })).others.map((review) => review.body);

    expect(await others(world.grace.caller)).toEqual(["friends review"]);
    for (const caller of [anonymous, world.linus.caller, world.marie.caller]) {
      expect(await others(caller)).toEqual([]);
    }
    expect((await world.ada.caller.reviews.list({ target })).mine).toMatchObject({
      visibility: "friends",
    });
  });

  it("never lists a private review for anyone else, friend or not", async () => {
    const target = { mediaId: world.titles.dune.id };

    for (const caller of [anonymous, world.grace.caller, world.linus.caller]) {
      expect((await caller.reviews.list({ target })).others).toEqual([]);
    }
  });

  it("opens a friends-only list for its owner and their friends alone", async () => {
    const id = world.listIds.friends as string;

    expect(await world.ada.caller.lists.get({ id })).toMatchObject({ isOwner: true });
    expect(await world.grace.caller.lists.get({ id })).toMatchObject({
      name: "friends list",
      isOwner: false,
    });
    for (const caller of [anonymous, world.linus.caller, world.marie.caller]) {
      await expect(caller.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("opens a private list for its owner alone", async () => {
    const id = world.listIds.private as string;

    expect(await world.ada.caller.lists.get({ id })).toMatchObject({ isOwner: true });
    for (const caller of [anonymous, world.grace.caller]) {
      await expect(caller.lists.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});

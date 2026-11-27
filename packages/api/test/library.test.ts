import { db } from "@yousiverse/db";
import { media, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

async function addTitles() {
  const [matrix, hades, dune] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "book", title: "Dune", provider: "open_library", providerId: "OL893414W" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !dune) throw new Error("Titles were not created.");
  return { matrix: matrix.id, hades: hades.id, dune: dune.id };
}

describe("library", () => {
  let titles: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    titles = await addTitles();
  });

  it("requires signing in", async () => {
    await expect(anonymous.library.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymous.library.save({ mediaId: titles.matrix, status: "want" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("adds a title as public by default", async () => {
    const { caller } = await signedInAs("Ada");

    await caller.library.save({ mediaId: titles.matrix, status: "want" });

    expect(await caller.library.entry({ mediaId: titles.matrix })).toEqual({
      status: "want",
      visibility: "public",
      progress: null,
    });
  });

  it("has no entry for a title that was never added", async () => {
    const { caller } = await signedInAs("Ada");

    expect(await caller.library.entry({ mediaId: titles.matrix })).toBeNull();
  });

  it("changes the status of a title without adding it twice or changing who can see it", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: titles.matrix, status: "want", visibility: "private" });

    await caller.library.save({ mediaId: titles.matrix, status: "finished" });

    expect((await caller.library.list()).entries).toMatchObject([
      { title: "The Matrix", status: "finished", visibility: "private" },
    ]);
  });

  it("rejects a status that does not exist", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      // @ts-expect-error "on_hold" is deliberately not a status
      caller.library.save({ mediaId: titles.matrix, status: "on_hold" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses to add a title that is not in the catalog", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(
      caller.library.save({ mediaId: "00000000-0000-4000-8000-000000000000", status: "want" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removes a title", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: titles.matrix, status: "want" });

    await caller.library.remove({ mediaId: titles.matrix });

    expect((await caller.library.list()).entries).toEqual([]);
  });

  it("filters by media type and by status", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.library.save({ mediaId: titles.matrix, status: "finished" });
    await caller.library.save({ mediaId: titles.hades, status: "in_progress" });
    await caller.library.save({ mediaId: titles.dune, status: "finished" });

    const titlesOf = (list: { entries: { title: string }[] }) =>
      list.entries.map((entry) => entry.title).sort();
    expect(titlesOf(await caller.library.list())).toEqual(["Dune", "Hades", "The Matrix"]);
    expect(titlesOf(await caller.library.list({ type: "game" }))).toEqual(["Hades"]);
    expect(titlesOf(await caller.library.list({ status: "finished" }))).toEqual([
      "Dune",
      "The Matrix",
    ]);
    expect((await caller.library.list({ type: "book", status: "dropped" })).entries).toEqual([]);
  });

  it("keeps each person's library separate", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.library.save({ mediaId: titles.matrix, status: "finished" });
    await grace.caller.library.save({ mediaId: titles.matrix, status: "dropped" });

    await grace.caller.library.remove({ mediaId: titles.matrix });

    expect((await grace.caller.library.list()).entries).toEqual([]);
    expect(await grace.caller.library.entry({ mediaId: titles.matrix })).toBeNull();
    expect((await ada.caller.library.list()).entries).toMatchObject([
      { title: "The Matrix", status: "finished" },
    ]);
  });
});

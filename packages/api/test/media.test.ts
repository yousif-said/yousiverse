import { db } from "@yousiverse/db";
import { media } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/root";

const caller = appRouter.createCaller({ db, session: null });

describe("media.shelf", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  it("returns an empty shelf when there is no media", async () => {
    expect(await caller.media.shelf()).toEqual([]);
  });

  it("returns media of every type ordered by title", async () => {
    await db.insert(media).values([
      { type: "game", title: "Hades", releaseYear: 2020 },
      { type: "book", title: "Dune", releaseYear: 1965 },
      { type: "tv", title: "Arcane", releaseYear: null },
    ]);

    const shelf = await caller.media.shelf();

    expect(shelf.map(({ type, title, releaseYear }) => ({ type, title, releaseYear }))).toEqual([
      { type: "tv", title: "Arcane", releaseYear: null },
      { type: "book", title: "Dune", releaseYear: 1965 },
      { type: "game", title: "Hades", releaseYear: 2020 },
    ]);
  });

  it("caps the shelf at 24 items", async () => {
    await db
      .insert(media)
      .values(
        Array.from({ length: 30 }, (_, i) => ({ type: "movie" as const, title: `Movie ${i}` })),
      );

    expect(await caller.media.shelf()).toHaveLength(24);
  });
});

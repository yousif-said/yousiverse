import { db } from "@yousiverse/db";
import { media } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/root";

const caller = appRouter.createCaller({ db, session: null });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe("media.shelf", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  it("returns an empty shelf when the catalog is empty", async () => {
    expect(await caller.media.shelf()).toEqual([]);
  });

  it("returns titles of every type, most recently added first", async () => {
    await db.insert(media).values([
      {
        type: "game",
        title: "Hades",
        provider: "igdb",
        providerId: "113112",
        createdAt: minutesAgo(3),
      },
      {
        type: "book",
        title: "Dune",
        provider: "open_library",
        providerId: "OL893414W",
        createdAt: minutesAgo(1),
      },
      {
        type: "tv",
        title: "Arcane",
        provider: "tmdb",
        providerId: "94605",
        createdAt: minutesAgo(2),
      },
    ]);

    const shelf = await caller.media.shelf();

    expect(shelf.map(({ type, title, providerId }) => ({ type, title, providerId }))).toEqual([
      { type: "book", title: "Dune", providerId: "OL893414W" },
      { type: "tv", title: "Arcane", providerId: "94605" },
      { type: "game", title: "Hades", providerId: "113112" },
    ]);
  });

  it("leaves out titles that have no page to link to", async () => {
    await db.insert(media).values({ type: "movie", title: "No provider" });

    expect(await caller.media.shelf()).toEqual([]);
  });

  it("caps the shelf at 24 items", async () => {
    await db.insert(media).values(
      Array.from({ length: 30 }, (_, index) => ({
        type: "movie" as const,
        title: `Movie ${index}`,
        provider: "tmdb" as const,
        providerId: String(index + 1),
      })),
    );

    expect(await caller.media.shelf()).toHaveLength(24);
  });
});

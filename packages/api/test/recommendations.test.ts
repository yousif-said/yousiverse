import { db } from "@yousiverse/db";
import { media, similarChecks, similarTitles, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
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
      type: "movie",
      providerId: "603",
      title: "The Matrix",
      rating: 28,
    });
    expect(rows[0]?.titles).toHaveLength(6);
    expect(rows[0]?.titles[0]).toEqual({
      type: "movie",
      providerId: "604",
      title: "The Matrix Reloaded",
      releaseYear: 2003,
      posterUrl: expect.stringContaining("https://"),
    });
  });

  it("covers every media type, with an author's other books standing in for similar books", async () => {
    const { caller } = await signedInAs("Ada");
    await rate(caller, await addTitle(SEVERANCE), 10);
    await rate(caller, await addTitle(HADES), 9);
    await rate(caller, await addTitle(PIRANESI), 8);

    const { rows } = await caller.recommendations.forYou();

    expect(rows.map((row) => row.seed.title)).toEqual(["Severance", "Hades", "Piranesi"]);
    expect(rows[0]?.titles[0]).toMatchObject({ type: "tv", title: "Emergence" });
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

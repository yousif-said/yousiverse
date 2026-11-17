import { db } from "@yousiverse/db";
import { episodes, libraryEntries, media, seasons, tvShows, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, usToday } from "../src/calendar/dates";
import { findTitlesToRefresh, runCalendarRefresh, TITLES_PER_RUN } from "../src/calendar/refresh";
import type { StepRunner } from "../src/step-runner";
import { anonymous, signedInAs } from "./helpers";

const today = usToday();
const inDays = (days: number) => addDays(today, days);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

let nextId = 500_000;
const movie = (
  title: string,
  releaseDate: string | null,
  extra: Partial<typeof media.$inferInsert> = {},
) =>
  addTitle({
    type: "movie",
    title,
    releaseDate,
    provider: "tmdb",
    providerId: String(nextId++),
    ...extra,
  });

/** A show with one season whose episodes air on the given dates. */
async function show(title: string, airDates: (string | null)[], seasonNumber = 2) {
  const mediaId = await addTitle({
    type: "tv",
    title,
    provider: "tmdb",
    providerId: String(nextId++),
  });
  const [season] = await db
    .insert(seasons)
    .values({ mediaId, seasonNumber, name: `Season ${seasonNumber}` })
    .returning({ id: seasons.id });
  await db.insert(episodes).values(
    airDates.map((airDate, index) => ({
      seasonId: season?.id ?? "",
      episodeNumber: index + 1,
      name: `Episode ${index + 1}`,
      airDate,
    })),
  );
  return mediaId;
}

describe("calendar.upcoming", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  it("lists releases in the next 90 days, soonest first, for anyone", async () => {
    await movie("Later", inDays(40));
    await movie("Sooner", inDays(3));
    await movie("Today", today);
    await movie("Yesterday", inDays(-1));
    await movie("Too far off", inDays(91));
    await movie("No date", null);
    await addTitle({
      type: "game",
      title: "A Game",
      releaseDate: inDays(10),
      provider: "igdb",
      providerId: "77",
    });

    const { entries, today: reported } = await anonymous.calendar.upcoming({ scope: "catalog" });

    expect(reported).toBe(today);
    expect(entries.map((entry) => [entry.date, entry.title.title, entry.kind])).toEqual([
      [today, "Today", "release"],
      [inDays(3), "Sooner", "release"],
      [inDays(10), "A Game", "release"],
      [inDays(40), "Later", "release"],
    ]);
    expect(entries[2]?.title).toEqual({ type: "game", providerId: "77", title: "A Game" });
  });

  it("lists a show by its upcoming episodes, not by when it first aired", async () => {
    await addTitle({
      type: "tv",
      title: "Old Show",
      releaseDate: inDays(5),
      provider: "tmdb",
      providerId: "9001",
    });
    await show("Weekly", [inDays(-7), inDays(0), inDays(7), null]);

    const { entries } = await anonymous.calendar.upcoming({ scope: "catalog" });

    expect(entries).toEqual([
      {
        kind: "episodes",
        date: today,
        title: { type: "tv", providerId: expect.any(String), title: "Weekly" },
        seasonNumber: 2,
        firstEpisode: 2,
        lastEpisode: 2,
        count: 1,
        episodeName: "Episode 2",
      },
      expect.objectContaining({ date: inDays(7), firstEpisode: 3, episodeName: "Episode 3" }),
    ]);
  });

  it("counts a show's episodes on one day together", async () => {
    await show("Binge", [inDays(4), inDays(4), inDays(4)]);

    const { entries } = await anonymous.calendar.upcoming({ scope: "catalog" });

    expect(entries).toMatchObject([
      { kind: "episodes", count: 3, firstEpisode: 1, lastEpisode: 3, episodeName: null },
    ]);
  });

  it("filters by media type", async () => {
    await movie("A Film", inDays(2));
    await show("A Show", [inDays(2)]);

    const films = await anonymous.calendar.upcoming({ scope: "catalog", type: "movie" });
    const shows = await anonymous.calendar.upcoming({ scope: "catalog", type: "tv" });

    expect(films.entries.map((entry) => entry.title.title)).toEqual(["A Film"]);
    expect(shows.entries.map((entry) => entry.title.title)).toEqual(["A Show"]);
  });

  it("needs signing in to show a library, and shows only that person's titles", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const wanted = await movie("Wanted", inDays(5));
    const dropped = await movie("Dropped", inDays(6));
    const following = await show("Following", [inDays(8)]);
    const graces = await movie("Grace's", inDays(9));
    await movie("Nobody's", inDays(10));
    await ada.caller.library.save({ mediaId: wanted, status: "want" });
    await ada.caller.library.save({ mediaId: dropped, status: "dropped" });
    await ada.caller.library.save({
      mediaId: following,
      status: "finished",
      visibility: "private",
    });
    await grace.caller.library.save({ mediaId: graces, status: "want" });

    await expect(anonymous.calendar.upcoming({ scope: "library" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const { entries } = await ada.caller.calendar.upcoming({ scope: "library" });
    expect(entries.map((entry) => entry.title.title)).toEqual(["Wanted", "Following"]);
    expect((await ada.caller.calendar.upcoming({ scope: "catalog" })).entries).toHaveLength(5);
  });
});

describe("calendar refresh", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  const immediately: StepRunner = (_name, work) => work();

  /** Puts a title in a library, since only those are refreshed. */
  async function inLibrary(mediaId: string, userId: string, status: "want" | "dropped" = "want") {
    await db.insert(libraryEntries).values({ userId, mediaId, status });
  }

  it("picks titles in a library whose dates could still change, the longest unrefreshed first", async () => {
    const { user } = await signedInAs("Ada");
    const old = { syncedAt: daysAgo(10) };
    const upcoming = await movie("Upcoming", inDays(30), { syncedAt: daysAgo(5) });
    const undated = await movie("Undated", null, old);
    const listedOnly = await movie("Listed only", null);
    const longOut = await movie("Long out", inDays(-400), old);
    const justOut = await movie("Just out", inDays(-10), { syncedAt: daysAgo(4) });
    const fresh = await movie("Fresh", inDays(30), { syncedAt: daysAgo(1) });
    const unwanted = await movie("In no library", inDays(30), old);
    const droppedId = await movie("Dropped", inDays(30), old);
    const running = await addTitle({
      type: "tv",
      title: "Running",
      provider: "tmdb",
      providerId: "71",
      ...old,
    });
    const ended = await addTitle({
      type: "tv",
      title: "Ended",
      provider: "tmdb",
      providerId: "72",
      ...old,
    });
    await db.insert(tvShows).values([
      { mediaId: running, status: "Returning Series" },
      { mediaId: ended, status: "Ended" },
    ]);
    const book = await addTitle({
      type: "book",
      title: "A Book",
      provider: "open_library",
      providerId: "OL1W",
      ...old,
    });
    for (const id of [
      upcoming,
      undated,
      listedOnly,
      longOut,
      justOut,
      fresh,
      running,
      ended,
      book,
    ]) {
      await inLibrary(id, user.id);
    }
    await inLibrary(droppedId, user.id, "dropped");

    const due = await findTitlesToRefresh(db);

    const titles = await db
      .select({ title: media.title, providerId: media.providerId })
      .from(media);
    const named = due.map(
      (ref) => titles.find((title) => title.providerId === ref.providerId)?.title,
    );
    expect(named[0]).toBe("Listed only");
    expect(named.slice(1, 3).sort()).toEqual(["Running", "Undated"]);
    expect(named.slice(3)).toEqual(["Upcoming", "Just out"]);
    expect(unwanted).toBeTruthy();
  });

  it("fetches no more than a run's budget", async () => {
    const { user } = await signedInAs("Ada");
    const titles = await db
      .insert(media)
      .values(
        Array.from({ length: TITLES_PER_RUN + 3 }, (_, index) => ({
          type: "movie" as const,
          title: `Film ${index}`,
          provider: "tmdb" as const,
          providerId: String(600_000 + index),
        })),
      )
      .returning({ id: media.id });
    await db
      .insert(libraryEntries)
      .values(titles.map(({ id }) => ({ userId: user.id, mediaId: id, status: "want" as const })));

    expect(await findTitlesToRefresh(db)).toHaveLength(TITLES_PER_RUN);
  });

  it("refreshes what is due, tolerating a provider failure, and then has nothing left", async () => {
    const { user } = await signedInAs("Ada");
    // Listed by an import: no details yet. The recorded answers know The Matrix.
    const matrixId = await addTitle({
      type: "movie",
      title: "The Matrix",
      provider: "tmdb",
      providerId: "603",
    });
    const offlineId = await addTitle({
      type: "movie",
      title: "Offline",
      provider: "tmdb",
      providerId: "424242",
    });
    await inLibrary(matrixId, user.id);
    await inLibrary(offlineId, user.id);

    expect(await runCalendarRefresh(db, immediately)).toEqual({ titles: 2, refreshed: 1 });

    const [matrix] = await db.select().from(media).where(eq(media.id, matrixId));
    expect(matrix).toMatchObject({ releaseDate: "1999-03-31", syncedAt: expect.any(Date) });
    // The Matrix came out long ago, so it is settled. The title that failed is still due.
    expect(await findTitlesToRefresh(db)).toEqual([{ type: "movie", providerId: "424242" }]);
  });
});

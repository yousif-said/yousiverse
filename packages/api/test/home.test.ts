import { db } from "@yousiverse/db";
import {
  alerts,
  availabilityChecks,
  books,
  clubPicks,
  clubs,
  episodes,
  libraryEntries,
  media,
  reviews,
  seasons,
  streamingOffers,
  streamingServices,
  userSubscriptions,
  users,
} from "@yousiverse/db/schema";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays, usToday } from "../src/calendar/dates";
import { anonymous, signedInAs } from "./helpers";

type Person = Awaited<ReturnType<typeof signedInAs>>;

const today = usToday();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

const MATRIX = { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" } as const;
const HADES = { type: "game", title: "Hades", provider: "igdb", providerId: "113112" } as const;
const PIRANESI = {
  type: "book",
  title: "Piranesi",
  provider: "open_library",
  providerId: "OL20893680W",
} as const;

/** A show with one season. Each episode airs on the day given, or has no date. */
async function addShow(title: string, providerId: string, airDates: (string | null)[]) {
  const show = await addTitle({ type: "tv", title, provider: "tmdb", providerId });
  const [season] = await db
    .insert(seasons)
    .values({ mediaId: show, seasonNumber: 1, name: "Season 1" })
    .returning({ id: seasons.id });
  if (!season) throw new Error("The season was not created.");
  const created = await db
    .insert(episodes)
    .values(
      airDates.map((airDate, index) => ({
        seasonId: season.id,
        episodeNumber: index + 1,
        name: `Episode ${index + 1}`,
        airDate,
        runtimeMinutes: 50 + index,
      })),
    )
    .returning({ id: episodes.id });
  return { id: show, episodes: created.map((episode) => episode.id) };
}

/** Sets when a library entry was last touched, which is what Home orders by. */
const touched = (person: Person, mediaId: string, at: Date) =>
  db
    .update(libraryEntries)
    .set({ updatedAt: at })
    .where(and(eq(libraryEntries.userId, person.user.id), eq(libraryEntries.mediaId, mediaId)));

/** Stores an offer of a title on a service, as an availability check would. */
async function offerOn(
  mediaId: string,
  name: string,
  {
    kind = "subscription",
    rank = 1,
  }: { kind?: "subscription" | "free" | "rent"; rank?: number } = {},
) {
  const [service] = await db
    .insert(streamingServices)
    .values({ watchmodeId: Math.floor(Math.random() * 1e9), name, subscription: true, rank })
    .returning({ id: streamingServices.id });
  if (!service) throw new Error("The service was not created.");
  await db
    .insert(streamingOffers)
    .values({ mediaId, serviceId: service.id, kind, url: "https://example.com/watch" });
  return service.id;
}

const subscribe = (person: Person, serviceId: string) =>
  db.insert(userSubscriptions).values({ userId: person.user.id, serviceId });

describe("home.summary", () => {
  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    await db.delete(streamingServices);
  });

  it("requires signing in", async () => {
    await expect(anonymous.home.summary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("is empty, and says the library is, for someone new", async () => {
    const ada = await signedInAs("Ada");

    expect(await ada.caller.home.summary()).toEqual({
      today,
      librarySize: 0,
      followingCount: 0,
      inProgress: { total: 0, lead: null, others: [] },
      comingUp: [],
      ready: [],
      activity: [],
      cameThrough: [],
      discussions: [],
    });
  });

  describe("what to pick up", () => {
    it("leads with a show whose next episode is out, and says which episode that is", async () => {
      const ada = await signedInAs("Ada");
      const show = await addShow("Severance", "95396", ["2022-02-18", "2022-02-25", null]);
      const book = await addTitle(PIRANESI);
      await db.insert(books).values({ mediaId: book, pageCount: 272 });
      const game = await addTitle(HADES);
      const [firstEpisode, secondEpisode] = show.episodes as [string, string];

      await ada.caller.library.setWatched({ episodeId: firstEpisode, watched: true });
      await ada.caller.library.save({ mediaId: book, status: "in_progress" });
      await ada.caller.library.setProgress({ mediaId: book, pagesRead: 141 });
      await ada.caller.library.save({ mediaId: game, status: "in_progress" });
      await touched(ada, show.id, minutesAgo(30));
      await touched(ada, book, minutesAgo(20));
      await touched(ada, game, minutesAgo(10));

      const { inProgress, librarySize } = await ada.caller.home.summary();

      expect(librarySize).toBe(3);
      expect(inProgress.total).toBe(3);
      expect(inProgress.lead).toMatchObject({
        title: "Severance",
        providerId: "95396",
        progress: {
          kind: "episodes",
          watched: 1,
          total: 3,
          next: { seasonNumber: 1, episodeNumber: 2, inSeason: 3, watchedInSeason: 1 },
        },
        nextEpisode: { id: secondEpisode, runtimeMinutes: 51 },
      });
      // The rest follow, most recently touched first.
      expect(inProgress.others).toMatchObject([
        { title: "Hades", progress: null },
        { title: "Piranesi", progress: { kind: "pages", read: 141, of: 272 } },
      ]);
    });

    it("leads with whatever was touched last when no show has an episode waiting", async () => {
      const ada = await signedInAs("Ada");
      const upcoming = await addShow("Slow Horses", "95480", ["2022-04-01", addDays(today, 3)]);
      const game = await addTitle(HADES);
      await ada.caller.library.setWatched({
        episodeId: upcoming.episodes[0] as string,
        watched: true,
      });
      await ada.caller.library.save({ mediaId: game, status: "in_progress" });
      await touched(ada, upcoming.id, minutesAgo(20));
      await touched(ada, game, minutesAgo(10));

      const { inProgress } = await ada.caller.home.summary();

      expect(inProgress.lead).toMatchObject({ title: "Hades", nextEpisode: null });
      expect(inProgress.others).toMatchObject([{ title: "Slow Horses" }]);
    });

    it("shows three beside the lead, and counts the rest", async () => {
      const ada = await signedInAs("Ada");
      for (let index = 0; index < 6; index++) {
        const id = await addTitle({
          type: "game",
          title: `Game ${index}`,
          provider: "igdb",
          providerId: String(1000 + index),
        });
        await ada.caller.library.save({ mediaId: id, status: "in_progress" });
        await touched(ada, id, minutesAgo(index));
      }
      const finished = await addTitle(MATRIX);
      await ada.caller.library.save({ mediaId: finished, status: "finished" });

      const { inProgress } = await ada.caller.home.summary();

      expect(inProgress.total).toBe(6);
      expect(inProgress.lead?.title).toBe("Game 0");
      expect(inProgress.others.map((entry) => entry.title)).toEqual(["Game 1", "Game 2", "Game 3"]);
    });
  });

  describe("what is coming up", () => {
    it("gives the next dated thing for each title in the library, soonest first", async () => {
      const ada = await signedInAs("Ada");
      const show = await addShow("Severance", "95396", [
        addDays(today, -7),
        addDays(today, 2),
        addDays(today, 9),
      ]);
      const movie = await addTitle({ ...MATRIX, releaseDate: addDays(today, 30) });
      const outToday = await addTitle({ ...HADES, releaseDate: today });
      await ada.caller.library.save({ mediaId: show.id, status: "in_progress" });
      await ada.caller.library.save({ mediaId: movie, status: "want" });
      await ada.caller.library.save({ mediaId: outToday, status: "want" });

      const { comingUp } = await ada.caller.home.summary();

      expect(comingUp).toMatchObject([
        { kind: "release", date: today, title: { title: "Hades", providerId: "113112" } },
        {
          kind: "episode",
          date: addDays(today, 2),
          title: { title: "Severance", type: "tv" },
          seasonNumber: 1,
          episodeNumber: 2,
        },
        { kind: "release", date: addDays(today, 30), title: { title: "The Matrix" } },
      ]);
    });

    it("leaves out dropped titles, other people's titles, and dates outside the next 90 days", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const dropped = await addTitle({ ...MATRIX, releaseDate: addDays(today, 5) });
      const graces = await addTitle({ ...HADES, releaseDate: addDays(today, 5) });
      const farOff = await addTitle({
        type: "movie",
        title: "Far Off",
        provider: "tmdb",
        providerId: "1",
        releaseDate: addDays(today, 91),
      });
      const alreadyOut = await addTitle({
        type: "movie",
        title: "Already Out",
        provider: "tmdb",
        providerId: "2",
        releaseDate: addDays(today, -1),
      });
      await ada.caller.library.save({ mediaId: dropped, status: "dropped" });
      await grace.caller.library.save({ mediaId: graces, status: "want" });
      await ada.caller.library.save({ mediaId: farOff, status: "want" });
      await ada.caller.library.save({ mediaId: alreadyOut, status: "finished" });

      expect((await ada.caller.home.summary()).comingUp).toEqual([]);
    });
  });

  describe("ready when you are", () => {
    it("lists wanted movies and shows that a subscription of the person's carries", async () => {
      const ada = await signedInAs("Ada");
      const matrix = await addTitle(MATRIX);
      const show = await addShow("Severance", "95396", ["2022-02-18"]);
      const lessUsed = await offerOn(matrix, "Hulu", { rank: 5 });
      const mostUsed = await offerOn(matrix, "Netflix", { rank: 1 });
      const showService = await offerOn(show.id, "Apple TV+", { rank: 3 });
      for (const service of [lessUsed, mostUsed, showService]) await subscribe(ada, service);
      await ada.caller.library.save({ mediaId: matrix, status: "want" });
      await ada.caller.library.save({ mediaId: show.id, status: "want" });
      await touched(ada, show.id, minutesAgo(10));
      await touched(ada, matrix, minutesAgo(5));

      const { ready } = await ada.caller.home.summary();

      // Each title once, with the most widely used of the person's services that has it.
      expect(ready).toMatchObject([
        { title: "The Matrix", providerId: "603", service: { name: "Netflix", logoUrl: null } },
        { title: "Severance", type: "tv", service: { name: "Apple TV+" } },
      ]);
    });

    it("counts only the person's own subscriptions, only subscription offers, and only the want list", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const notSubscribed = await addTitle(MATRIX);
      const rented = await addTitle({ ...MATRIX, title: "Rented", providerId: "604" });
      const finished = await addTitle({ ...MATRIX, title: "Finished", providerId: "605" });
      const gracesService = await offerOn(notSubscribed, "Netflix");
      const rentalStore = await offerOn(rented, "Apple TV", { kind: "rent" });
      const adasService = await offerOn(finished, "Hulu");
      await subscribe(grace, gracesService);
      await subscribe(ada, rentalStore);
      await subscribe(ada, adasService);
      await ada.caller.library.save({ mediaId: notSubscribed, status: "want" });
      await ada.caller.library.save({ mediaId: rented, status: "want" });
      await ada.caller.library.save({ mediaId: finished, status: "finished" });

      expect((await ada.caller.home.summary()).ready).toEqual([]);
    });

    it("never looks availability up: a wanted title with no stored offers is left out", async () => {
      const ada = await signedInAs("Ada");
      // The recorded answers have The Matrix on a subscription service, so a lookup would find it.
      const matrix = await addTitle(MATRIX);
      const other = await addTitle({ ...MATRIX, title: "Other", providerId: "604" });
      await subscribe(ada, await offerOn(other, "YouTube TV"));
      await ada.caller.library.save({ mediaId: matrix, status: "want" });

      expect((await ada.caller.home.summary()).ready).toEqual([]);
      expect(await db.$count(availabilityChecks)).toBe(0);
      expect(await db.$count(streamingOffers, eq(streamingOffers.mediaId, matrix))).toBe(0);
    });
  });

  describe("activity from people the viewer follows", () => {
    /**
     * Ada and Grace follow each other, so they are friends. Linus follows Grace without being
     * followed back. Marie follows nobody.
     */
    async function setUp() {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const linus = await signedInAs("Linus");
      const marie = await signedInAs("Marie");
      await ada.caller.follows.follow({ username: "grace" });
      await grace.caller.follows.follow({ username: "ada" });
      await linus.caller.follows.follow({ username: "grace" });

      const titles = {
        public: await addTitle(MATRIX),
        friends: await addTitle(HADES),
        private: await addTitle(PIRANESI),
      };
      return { ada, grace, linus, marie, titles };
    }

    const levels = ["public", "friends", "private"] as const;

    const seen = async (person: Person) =>
      (await person.caller.home.summary()).activity
        .map((item) =>
          item.kind === "review"
            ? `${item.username} reviewed ${item.title.title}: ${item.body}`
            : `${item.username} ${item.status} ${item.title.title}`,
        )
        .sort();

    it("shows library changes to those who may see them: friends, followers, nobody else", async () => {
      const { ada, grace, linus, marie, titles } = await setUp();
      for (const visibility of levels) {
        await grace.caller.library.save({
          mediaId: titles[visibility],
          status: "finished",
          visibility,
        });
      }

      // A friend sees what is public and what is for friends. Nobody sees what is private.
      expect(await seen(ada)).toEqual(["grace finished Hades", "grace finished The Matrix"]);
      // A follower who is not followed back is not a friend.
      expect(await seen(linus)).toEqual(["grace finished The Matrix"]);
      expect((await linus.caller.home.summary()).followingCount).toBe(1);
      // Someone who does not follow Grace sees nothing of hers, and nor does Grace herself.
      expect(await seen(marie)).toEqual([]);
      expect(await seen(grace)).toEqual([]);
    });

    it("shows reviews to those who may see them: friends, followers, nobody else", async () => {
      const { ada, grace, linus, marie, titles } = await setUp();
      for (const visibility of levels) {
        await grace.caller.reviews.save({
          target: { mediaId: titles[visibility] },
          body: `for ${visibility}`,
          visibility,
        });
      }

      expect(await seen(ada)).toEqual([
        "grace reviewed Hades: for friends",
        "grace reviewed The Matrix: for public",
      ]);
      expect(await seen(linus)).toEqual(["grace reviewed The Matrix: for public"]);
      expect(await seen(marie)).toEqual([]);
      expect(await seen(grace)).toEqual([]);
    });

    it("shows a title finished and then reviewed once, by the review a viewer may see", async () => {
      const { ada, grace, linus, titles } = await setUp();
      await grace.caller.library.save({ mediaId: titles.public, status: "finished" });
      await touched(grace, titles.public, minutesAgo(10));
      await grace.caller.reviews.save({
        target: { mediaId: titles.public },
        body: "Still holds up.",
        visibility: "friends",
      });
      await db.update(reviews).set({ createdAt: minutesAgo(5) });

      expect(await seen(ada)).toEqual(["grace reviewed The Matrix: Still holds up."]);
      // Linus may not read the review, so the library change is what he is shown.
      expect(await seen(linus)).toEqual(["grace finished The Matrix"]);

      // A change made after the review is news of its own.
      await grace.caller.library.save({ mediaId: titles.public, status: "dropped" });
      expect(await seen(ada)).toEqual([
        "grace dropped The Matrix",
        "grace reviewed The Matrix: Still holds up.",
      ]);
    });

    it("gives the three newest with the person's rating, and names the episode reviewed", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      await ada.caller.follows.follow({ username: "grace" });
      const matrix = await addTitle(MATRIX);
      const hades = await addTitle(HADES);
      const piranesi = await addTitle(PIRANESI);
      const show = await addShow("Severance", "95396", ["2022-02-18", "2022-02-25"]);

      await grace.caller.library.save({ mediaId: piranesi, status: "want" });
      await grace.caller.library.save({ mediaId: hades, status: "in_progress" });
      await grace.caller.library.save({ mediaId: matrix, status: "finished" });
      await grace.caller.ratings.save({ target: { mediaId: matrix }, value: 36 });
      await touched(grace, piranesi, minutesAgo(40));
      await touched(grace, hades, minutesAgo(30));
      await touched(grace, matrix, minutesAgo(20));
      await grace.caller.reviews.save({
        target: { episodeId: show.episodes[1] as string },
        body: "Tense.",
      });

      const { activity } = await ada.caller.home.summary();

      expect(activity).toMatchObject([
        {
          kind: "review",
          username: "grace",
          body: "Tense.",
          title: { title: "Severance", providerId: "95396" },
          episode: { seasonNumber: 1, episodeNumber: 2 },
        },
        {
          kind: "library",
          username: "grace",
          status: "finished",
          rating: 36,
          title: { title: "The Matrix", type: "movie" },
        },
        { kind: "library", status: "in_progress", rating: null, title: { title: "Hades" } },
      ]);
    });
  });

  describe("alerts that came through", () => {
    it("lists the person's own triggered alerts, the latest first, and no one else's", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const matrix = await addTitle(MATRIX);
      const hades = await addTitle(HADES);
      const waiting = await addTitle({ ...MATRIX, title: "Waiting", providerId: "604" });
      await db.insert(alerts).values([
        {
          userId: ada.user.id,
          mediaId: matrix,
          kind: "streamable",
          triggeredAt: minutesAgo(60),
          outcome: "now streaming on Netflix",
        },
        {
          userId: ada.user.id,
          mediaId: hades,
          kind: "price_at_most",
          targetCents: 1500,
          triggeredAt: minutesAgo(5),
          outcome: "now $12.49 at Steam",
        },
        { userId: ada.user.id, mediaId: waiting, kind: "streamable" },
        {
          userId: grace.user.id,
          mediaId: waiting,
          kind: "streamable",
          triggeredAt: minutesAgo(1),
          outcome: "now streaming on Hulu",
        },
      ]);

      const { cameThrough } = await ada.caller.home.summary();

      expect(cameThrough).toMatchObject([
        {
          kind: "price_at_most",
          outcome: "now $12.49 at Steam",
          title: { title: "Hades", type: "game", providerId: "113112" },
        },
        { kind: "streamable", outcome: "now streaming on Netflix", title: { title: "The Matrix" } },
      ]);
      expect(cameThrough[0]?.triggeredAt).toBeInstanceOf(Date);
    });
  });

  describe("discussions in the person's clubs", () => {
    it("lists the most recently active, with how many replies each has", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const club = await ada.caller.clubs.create({
        name: "Page Turners",
        access: "public",
        mediaTypes: ["book"],
      });
      await grace.caller.clubs.join({ id: club.id });
      const first = await ada.caller.discussions.start({
        clubId: club.id,
        title: "The ending",
        body: "Well?",
      });
      const second = await grace.caller.discussions.start({
        clubId: club.id,
        title: "Next pick",
        body: "Ideas?",
      });
      await grace.caller.discussions.reply({ threadId: first.id, body: "Loved it." });
      await ada.caller.discussions.reply({ threadId: first.id, body: "Same." });

      const { discussions } = await grace.caller.home.summary();

      expect(discussions).toMatchObject([
        {
          id: first.id,
          title: "The ending",
          replyCount: 2,
          club: { id: club.id, name: "Page Turners" },
        },
        { id: second.id, title: "Next pick", replyCount: 0 },
      ]);
      expect(discussions[0]?.activeAt).toBeInstanceOf(Date);
    });

    it("shows nothing from a club the person has not joined, public or invite only", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      for (const access of ["public", "invite_only"] as const) {
        const club = await ada.caller.clubs.create({
          name: `${access} club`,
          access,
          mediaTypes: ["movie"],
        });
        await ada.caller.discussions.start({ clubId: club.id, title: `In ${access}`, body: "Hi." });
      }

      expect((await grace.caller.home.summary()).discussions).toEqual([]);
      expect((await ada.caller.home.summary()).discussions).toHaveLength(2);
    });

    it("stops showing a club's discussions once the person leaves it", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const club = await ada.caller.clubs.create({
        name: "Film Night",
        access: "public",
        mediaTypes: ["movie"],
      });
      await ada.caller.discussions.start({ clubId: club.id, title: "Friday", body: "What?" });
      await grace.caller.clubs.join({ id: club.id });
      expect((await grace.caller.home.summary()).discussions).toHaveLength(1);

      await grace.caller.clubs.leave({ id: club.id });

      expect((await grace.caller.home.summary()).discussions).toEqual([]);
      expect(await db.$count(clubs)).toBe(1);
    });
  });
});

describe("home.wall", () => {
  beforeEach(async () => {
    await db.delete(media);
  });

  const poster = (name: string) => `https://image.tmdb.org/t/p/w500/${name}.jpg`;

  it("needs no sign-in and shows only titles that have a poster and a page", async () => {
    await db.insert(media).values([
      { ...MATRIX, posterUrl: poster("matrix"), backdropUrl: poster("matrix-wide") },
      { ...HADES, posterUrl: null },
      { type: "book", title: "Unlisted", posterUrl: poster("unlisted") },
    ]);

    const wall = await anonymous.home.wall();

    expect(wall).toMatchObject([
      {
        type: "movie",
        providerId: "603",
        title: "The Matrix",
        posterUrl: poster("matrix"),
        backdropUrl: poster("matrix-wide"),
      },
    ]);
  });

  it("deals the types out in turn, nine of each at most, the colorful ones first", async () => {
    const start = Date.parse("2026-03-01T12:00:00Z");
    await db.insert(media).values([
      ...Array.from({ length: 11 }, (_, index) => ({
        type: "movie" as const,
        title: `Movie ${index}`,
        provider: "tmdb" as const,
        providerId: String(100 + index),
        posterUrl: poster(`movie-${index}`),
        // Movie 0 is the oldest and the only colorful one.
        artSaturation: index === 0 ? 60 : 10,
        createdAt: new Date(start + index * 60_000),
      })),
      { ...HADES, posterUrl: poster("hades"), createdAt: new Date(start) },
      { ...PIRANESI, posterUrl: poster("piranesi"), createdAt: new Date(start) },
    ]);

    const wall = await anonymous.home.wall();

    expect(wall.slice(0, 4).map((title) => title.title)).toEqual([
      "Movie 0",
      "Hades",
      "Piranesi",
      "Movie 10",
    ]);
    expect(wall.filter((title) => title.type === "movie")).toHaveLength(9);
    expect(wall).toHaveLength(11);
  });
});

describe("home.shell", () => {
  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
  });

  it("requires signing in", async () => {
    await expect(anonymous.home.shell()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("gives someone new their name, and nothing else", async () => {
    const ada = await signedInAs("Ada", { username: false });

    expect(await ada.caller.home.shell()).toEqual({
      name: "Ada",
      username: null,
      isReviewer: false,
      clubs: [],
      alertsCameThrough: 0,
    });
  });

  it("names the person's clubs in order, each in the color of its newest pick", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const readers = await ada.caller.clubs.create({
      name: "Page Turners",
      access: "public",
      mediaTypes: ["book"],
    });
    const players = await grace.caller.clubs.create({
      name: "Couch Co-op",
      access: "public",
      mediaTypes: ["game"],
    });
    await ada.caller.clubs.join({ id: players.id });
    await grace.caller.clubs.create({ name: "Not Ada's", access: "public", mediaTypes: ["movie"] });
    const hades = await addTitle({ ...HADES, artHue: 12 });
    const older = await addTitle({ ...HADES, title: "Older", providerId: "1", artHue: 200 });
    await grace.caller.clubs.addPick({ id: players.id, mediaId: older });
    await grace.caller.clubs.addPick({ id: players.id, mediaId: hades });
    await db
      .update(clubPicks)
      .set({ createdAt: minutesAgo(60) })
      .where(eq(clubPicks.mediaId, older));

    const shell = await ada.caller.home.shell();

    expect(shell.username).toBe("ada");
    expect(shell.clubs).toEqual([
      { id: players.id, name: "Couch Co-op", hue: 12 },
      { id: readers.id, name: "Page Turners", hue: null },
    ]);
  });

  it("counts the person's own alerts that came through, not those still waiting", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const matrix = await addTitle(MATRIX);
    const hades = await addTitle(HADES);
    await db.insert(alerts).values([
      { userId: ada.user.id, mediaId: matrix, kind: "streamable", triggeredAt: minutesAgo(5) },
      { userId: ada.user.id, mediaId: hades, kind: "price_at_most", targetCents: 1500 },
      { userId: grace.user.id, mediaId: matrix, kind: "streamable", triggeredAt: minutesAgo(1) },
    ]);

    expect((await ada.caller.home.shell()).alertsCameThrough).toBe(1);
    expect((await grace.caller.home.shell()).alertsCameThrough).toBe(1);
  });
});

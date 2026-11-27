/**
 * Fills a database with the sample world of the redesign mockup (redesign/mockup): the same
 * signed-in person, friends, library, ratings, reviews, lists, clubs, alerts, and universes, so
 * every screen can be looked at with something on it and compared with the mockup.
 *
 * The titles are real and are fetched from TMDB, IGDB, and Open Library. Everything about people
 * is invented, and so is every price and every "where to watch": nothing here asks Watchmode or
 * IsThereAnyDeal for anything.
 *
 * It erases every account in the database first, so it only runs against a database whose name
 * ends in "_design":
 *
 *   DATABASE_URL=postgres://yousiverse:yousiverse@localhost:5432/yousiverse_design \
 *     bun run --cwd packages/api demo:seed
 */
import { readFile } from "node:fs/promises";
import { db } from "@yousiverse/db";
import * as t from "@yousiverse/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ensureImported } from "../src/catalog/import";

type MediaType = t.MediaType;
type Status = t.LibraryStatus;
type Visibility = t.Visibility;

type CatalogTitle = {
  key: string;
  type: MediaType;
  id: string;
  title: string;
  year: number | null;
  date: string | null;
  steam?: string | null;
};
type Review = { by: string | null; rating: number; at: string; body: string };
type MockData = {
  TODAY: string;
  ME: { username: string; name: string; joined: string; email: string };
  PEOPLE: Record<string, { name: string; following: boolean; followsYou: boolean; joined: string }>;
  library: Record<
    string,
    {
      status: Status;
      at: string;
      visibility: Visibility;
      progress: { season?: number; episode?: number; page?: number; hours?: number } | null;
    }
  >;
  ratings: Record<string, number>;
  episodeRatings: Record<string, number>;
  subscriptions: Set<string>;
  MY_REVIEWS: Record<string, { rating: number; at: string; visibility: Visibility; body: string }>;
  UNIVERSES: {
    name: string;
    blurb: string;
    nodes: string[];
    edges: [string, string, "adapt" | "sequel"][];
  }[];
  LISTS: {
    name: string;
    by: string;
    visibility: Visibility;
    description: string;
    items: { key: string; note?: string }[];
  }[];
  CLUBS: {
    name: string;
    types: MediaType[];
    access: "public" | "invite";
    owner: string;
    description: string;
    members: string[];
    invite?: string;
    picks: { key: string; by: string }[];
    threads: {
      title: string;
      by: string;
      at: string;
      active: string;
      posts: { by: string; at: string; body: string }[];
    }[];
  }[];
  FEED: {
    who: string;
    kind: "review" | "library" | "list";
    key?: string;
    status?: Status;
    rating?: number | null;
    at: string;
    body?: string;
  }[];
  ALERTS: {
    key: string;
    kind: "mine" | "any" | "price";
    state: "fired" | "waiting";
    set: string;
    fired?: string;
    service?: string;
    target?: number;
    store?: string;
    price?: number;
  }[];
  RECOMMENDATIONS: { seed: string; keys: string[] }[];
  SUGGESTIONS: { a: string; b: string; relation: "adapt" | "same" }[];
  community(key: string): { average: number | null; count: number };
  distribution(key: string): number[];
  friendRatings(key: string): Record<string, number>;
  reviewsFor(key: string): Review[];
  streaming(key: string): {
    unreleased?: boolean;
    subscription?: string[];
    free?: string[];
    rent?: [string, number][];
    buy?: [string, number][];
  };
  gamePrices(key: string): {
    deals: [string, number][] | null;
    regular?: number;
    low?: number;
    unreleased?: boolean;
  };
  episodeAverage(key: string, season: number, episode: number, total: number): number;
  seed(text: string): number;
};

const databaseName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1);
if (!databaseName.endsWith("_design")) {
  throw new Error(
    `Refusing to fill "${databaseName}": the demo erases every account, so it only runs against a database whose name ends in _design.`,
  );
}

// ---- the mockup's own data, read from its script files ----
const sandbox: { CATALOG?: Record<string, CatalogTitle>; DATA?: MockData } = {};
for (const file of ["catalog.js", "data.js"]) {
  const code = await readFile(
    new URL(`../../../redesign/mockup/js/${file}`, import.meta.url),
    "utf8",
  );
  new Function("window", code)(sandbox);
}
const C = sandbox.CATALOG as Record<string, CatalogTitle>;
const D = sandbox.DATA as MockData;

const CROWD_SIZE = 40;
const CROWD_RATINGS_PER_TITLE = 32;
const CROWD_RATINGS_PER_EPISODE = 6;
const DEMO_URL = "https://www.example.com/";

/** Noon US Eastern on a calendar day, plus some minutes to put things in order. */
const at = (iso: string, minutes = 0) =>
  new Date(new Date(`${iso}T12:00:00-05:00`).getTime() + minutes * 60_000);
const quarters = (outOfTen: number) => Math.round(outOfTen * 4);
const userId = (username: string) => `demo-${username}`;
const crowdId = (index: number) => `demo-crowd-${index % CROWD_SIZE}`;
const released = (key: string) => !C[key]?.date || (C[key]?.date as string) <= D.TODAY;

function chunks<Row>(rows: Row[], size = 500): Row[][] {
  const out: Row[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

// ---- start clean ----
await db.execute(sql`truncate table ${t.users} cascade`);
for (const table of [
  t.streamingOffers,
  t.gameDeals,
  t.availabilityChecks,
  t.similarTitles,
  t.similarChecks,
]) {
  await db.delete(table);
}
await db.execute(sql`truncate table ${t.streamingServices} cascade`);

// ---- people ----
const people = { [D.ME.username]: { ...D.ME, following: false, followsYou: false }, ...D.PEOPLE };
await db.insert(t.users).values([
  ...Object.entries(people).map(([username, person]) => ({
    id: userId(username),
    name: person.name,
    email: username === D.ME.username ? D.ME.email : `${username}@example.com`,
    emailVerified: true,
    createdAt: at(person.joined),
  })),
  ...Array.from({ length: CROWD_SIZE }, (_, index) => ({
    id: crowdId(index),
    name: `Member ${index + 1}`,
    email: `crowd-${index + 1}@example.com`,
    emailVerified: true,
  })),
]);
await db.insert(t.profiles).values(
  Object.entries(people).map(([username, person]) => ({
    userId: userId(username),
    username,
    createdAt: at(person.joined),
  })),
);
const me = userId(D.ME.username);
const friendNames = Object.keys(D.PEOPLE);
await db.insert(t.follows).values([
  ...friendNames.flatMap((username) => [
    ...(D.PEOPLE[username]?.following ? [{ followerId: me, followedId: userId(username) }] : []),
    ...(D.PEOPLE[username]?.followsYou ? [{ followerId: userId(username), followedId: me }] : []),
  ]),
  // A few follows among the others, so their follower counts are not all one.
  ...friendNames.flatMap((username, index) =>
    [1, 3].map((step) => ({
      followerId: userId(username),
      followedId: userId(friendNames[(index + step) % friendNames.length] as string),
    })),
  ),
]);

// ---- titles, from the real providers ----
const mediaIds = new Map<string, string>();
const keys = Object.keys(C);
const CONCURRENCY = 2;
for (let i = 0; i < keys.length; i += CONCURRENCY) {
  await Promise.all(
    keys.slice(i, i + CONCURRENCY).map(async (key) => {
      const title = C[key] as CatalogTitle;
      try {
        mediaIds.set(key, await ensureImported(db, { type: title.type, providerId: title.id }));
      } catch (error) {
        console.warn(`Skipping ${key}: ${error instanceof Error ? error.message : error}`);
      }
    }),
  );
}
console.info(`Titles: ${mediaIds.size} of ${keys.length}`);
const id = (key: string) => mediaIds.get(key);
const known = keys.filter((key) => mediaIds.has(key));

// ---- streaming services, with their logos, from the recorded list ----
type RecordedService = { id: number; name: string; type: string; logo_100px?: string };
const recorded = JSON.parse(
  await readFile(
    new URL("../../integrations/src/fixtures/watchmode.json", import.meta.url),
    "utf8",
  ),
) as Record<string, { body: RecordedService[] }>;
const serviceList = recorded["GET api.watchmode.com/v1/sources/?regions=US"]?.body ?? [];
const services = await db
  .insert(t.streamingServices)
  .values(
    serviceList.map((service, rank) => ({
      watchmodeId: service.id,
      name: service.name,
      logoUrl: service.logo_100px ?? null,
      subscription: service.type === "sub",
      rank,
      listedAt: new Date(),
    })),
  )
  .returning({ id: t.streamingServices.id, watchmodeId: t.streamingServices.watchmodeId });
const serviceByWatchmodeId = new Map(services.map((service) => [service.watchmodeId, service.id]));
// The mockup's service names, as Watchmode's ids.
const WATCHMODE_IDS: Record<string, number> = {
  Netflix: 203,
  Max: 387,
  "Apple TV+": 371,
  "Prime Video": 26,
  Hulu: 157,
  "Disney+": 372,
  Peacock: 389,
  "Paramount+": 444,
  Tubi: 296,
  "Pluto TV": 391,
  "Apple TV": 349,
  Amazon: 24,
  "Fandango at Home": 307,
  YouTube: 344,
};
const serviceId = (name: string) => serviceByWatchmodeId.get(WATCHMODE_IDS[name] ?? -1);
await db.insert(t.userSubscriptions).values(
  [...D.subscriptions].flatMap((name) => {
    const found = serviceId(name);
    return found ? { userId: me, serviceId: found } : [];
  }),
);

// ---- where to watch and what games cost (invented) ----
const offers: (typeof t.streamingOffers.$inferInsert)[] = [];
const deals: (typeof t.gameDeals.$inferInsert)[] = [];
const checks: (typeof t.availabilityChecks.$inferInsert)[] = [];
for (const key of known) {
  const title = C[key] as CatalogTitle;
  const mediaId = id(key) as string;
  if (title.type === "movie" || title.type === "tv") {
    const where = D.streaming(key);
    checks.push({ mediaId, checkedAt: new Date() });
    const add = (name: string, kind: t.OfferKind, priceCents: number | null) => {
      const found = serviceId(name);
      if (found) offers.push({ mediaId, serviceId: found, kind, priceCents, url: DEMO_URL });
    };
    for (const name of where.subscription ?? []) add(name, "subscription", null);
    for (const name of where.free ?? []) add(name, "free", null);
    for (const [name, price] of where.rent ?? []) add(name, "rent", price);
    for (const [name, price] of where.buy ?? []) add(name, "buy", price);
  } else if (title.type === "game") {
    const prices = D.gamePrices(key);
    if (!prices.deals) continue;
    checks.push({ mediaId, checkedAt: new Date(), lowestPriceCents: prices.low ?? null });
    for (const [shop, priceCents] of prices.deals) {
      deals.push({
        mediaId,
        shop,
        priceCents,
        regularPriceCents: Math.max(prices.regular ?? priceCents, priceCents),
        url: DEMO_URL,
      });
    }
  }
}
for (const rows of chunks(offers))
  await db.insert(t.streamingOffers).values(rows).onConflictDoNothing();
for (const rows of chunks(deals)) await db.insert(t.gameDeals).values(rows).onConflictDoNothing();
for (const rows of chunks(checks)) await db.insert(t.availabilityChecks).values(rows);

// ---- episodes of every show, to hang watches and ratings on ----
const episodeRows = await db
  .select({
    id: t.episodes.id,
    mediaId: t.seasons.mediaId,
    season: t.seasons.seasonNumber,
    episode: t.episodes.episodeNumber,
    airDate: t.episodes.airDate,
  })
  .from(t.episodes)
  .innerJoin(t.seasons, eq(t.seasons.id, t.episodes.seasonId))
  .where(inArray(t.seasons.mediaId, [...mediaIds.values()]));
const episodesOf = (key: string) =>
  episodeRows
    .filter((row) => row.mediaId === id(key) && row.season > 0)
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
const aired = (row: { airDate: string | null }) => row.airDate !== null && row.airDate <= D.TODAY;

// ---- the signed-in person's library ----
const entries: (typeof t.libraryEntries.$inferInsert)[] = [];
const watches: (typeof t.episodeWatches.$inferInsert)[] = [];
for (const [key, entry] of Object.entries(D.library)) {
  const mediaId = id(key);
  if (!mediaId) continue;
  entries.push({
    userId: me,
    mediaId,
    status: entry.status,
    visibility: entry.visibility,
    pagesRead: entry.progress?.page ?? null,
    minutesPlayed: entry.progress?.hours ? entry.progress.hours * 60 : null,
    createdAt: at(entry.at),
    updatedAt: at(entry.at),
  });
  if (C[key]?.type !== "tv") continue;
  const upTo = entry.progress;
  for (const row of episodesOf(key)) {
    const seen =
      entry.status === "finished"
        ? aired(row)
        : upTo?.season !== undefined &&
          (row.season < upTo.season ||
            (row.season === upTo.season && row.episode <= (upTo.episode ?? 0)));
    if (seen) watches.push({ userId: me, episodeId: row.id, createdAt: at(entry.at) });
  }
}

// ---- ratings: the person's own, their friends', and a crowd behind the averages ----
type RatingRow = typeof t.ratings.$inferInsert;
const ratingRows = new Map<string, RatingRow>();
const rate = (row: RatingRow) =>
  ratingRows.set(`${row.userId}:${row.mediaId}:${row.episodeId ?? ""}`, row);

for (const [key, value] of Object.entries(D.ratings)) {
  const mediaId = id(key);
  if (mediaId) rate({ userId: me, mediaId, value, createdAt: at(D.library[key]?.at ?? D.TODAY) });
}
for (const [spot, value] of Object.entries(D.episodeRatings)) {
  const match = /^(.+)-(\d+)-(\d+)$/.exec(spot);
  if (!match) continue;
  const [, key, season, episode] = match as unknown as [string, string, string, string];
  const row = episodesOf(key).find(
    (candidate) => candidate.season === Number(season) && candidate.episode === Number(episode),
  );
  if (row) rate({ userId: me, mediaId: row.mediaId, episodeId: row.id, value });
}

/** Picks a half point from a title's spread of ratings, the same way every time. */
function sampleRating(key: string, salt: string): number {
  const bars = D.distribution(key);
  const total = bars.reduce((sum, bar) => sum + bar, 0);
  let roll = D.seed(`${key}${salt}`) * total;
  for (let bar = 0; bar < bars.length; bar++) {
    roll -= bars[bar] as number;
    if (roll <= 0) return bar * 2;
  }
  return 32;
}

const friendEntries = new Map<string, typeof t.libraryEntries.$inferInsert>();
const shelve = (username: string, key: string, status: Status, when: Date) => {
  const mediaId = id(key);
  if (mediaId) {
    friendEntries.set(`${username}:${key}`, {
      userId: userId(username),
      mediaId,
      status,
      createdAt: when,
      updatedAt: when,
    });
  }
};

for (const key of known) {
  if (!released(key)) continue;
  const mediaId = id(key) as string;
  for (const [username, outOfTen] of Object.entries(D.friendRatings(key))) {
    const day = 1 + Math.floor(D.seed(`${key}${username}day`) * 27);
    const month = 1 + Math.floor(D.seed(`${key}${username}month`) * 9);
    const when = at(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    rate({ userId: userId(username), mediaId, value: quarters(outOfTen), createdAt: when });
    shelve(username, key, "finished", when);
  }
  for (let index = 0; index < CROWD_RATINGS_PER_TITLE; index++) {
    const member = Math.floor(D.seed(`${key}crowd${index}`) * CROWD_SIZE);
    rate({ userId: crowdId(member), mediaId, value: sampleRating(key, `c${index}`) });
  }
}
for (const key of known.filter((candidate) => C[candidate]?.type === "tv")) {
  const all = episodesOf(key);
  for (const row of all.filter(aired)) {
    const inSeason = all.filter((candidate) => candidate.season === row.season).length;
    const average = D.episodeAverage(key, row.season, row.episode, inSeason);
    for (let index = 0; index < CROWD_RATINGS_PER_EPISODE; index++) {
      const spot = `${key}s${row.season}e${row.episode}c${index}`;
      const value = quarters(average + (D.seed(spot) - 0.5) * 1.6);
      rate({
        userId: crowdId(Math.floor(D.seed(`${spot}who`) * CROWD_SIZE)),
        mediaId: row.mediaId,
        episodeId: row.id,
        value: Math.min(40, Math.max(8, value)),
      });
    }
  }
}

// ---- reviews ----
type ReviewRow = typeof t.reviews.$inferInsert;
const reviewRows = new Map<string, ReviewRow>();
const review = (row: ReviewRow, rating: number) => {
  reviewRows.set(`${row.userId}:${row.mediaId}`, row);
  rate({
    userId: row.userId,
    mediaId: row.mediaId,
    value: quarters(rating),
    createdAt: row.createdAt,
  });
};
for (const key of known) {
  if (!released(key)) continue;
  const mediaId = id(key) as string;
  D.reviewsFor(key).forEach((item, index) => {
    const author = item.by
      ? userId(item.by)
      : crowdId(Math.floor(D.seed(`${key}anon${index}`) * CROWD_SIZE));
    review(
      { userId: author, mediaId, body: item.body, createdAt: at(item.at), updatedAt: at(item.at) },
      item.rating,
    );
    if (item.by) shelve(item.by, key, "finished", at(item.at));
  });
}
for (const [key, mine] of Object.entries(D.MY_REVIEWS)) {
  const mediaId = id(key);
  if (!mediaId) continue;
  reviewRows.set(`${me}:${mediaId}`, {
    userId: me,
    mediaId,
    body: mine.body,
    visibility: mine.visibility,
    createdAt: at(mine.at),
    updatedAt: at(mine.at),
  });
}

// ---- what friends did lately, which is what the feed shows ----
D.FEED.forEach((item, index) => {
  if (!item.key || !id(item.key)) return;
  const when = at(item.at, -index * 7);
  const mediaId = id(item.key) as string;
  if (item.kind === "library" && item.status) shelve(item.who, item.key, item.status, when);
  if (item.kind === "review" && item.body) {
    review(
      { userId: userId(item.who), mediaId, body: item.body, createdAt: when, updatedAt: when },
      item.rating ?? 8,
    );
    shelve(item.who, item.key, "finished", when);
  } else if (item.rating != null) {
    rate({ userId: userId(item.who), mediaId, value: quarters(item.rating), createdAt: when });
  }
});

for (const rows of chunks([...entries, ...friendEntries.values()])) {
  await db.insert(t.libraryEntries).values(rows).onConflictDoNothing();
}
for (const rows of chunks(watches))
  await db.insert(t.episodeWatches).values(rows).onConflictDoNothing();
for (const rows of chunks([...ratingRows.values()]))
  await db.insert(t.ratings).values(rows).onConflictDoNothing();
for (const rows of chunks([...reviewRows.values()]))
  await db.insert(t.reviews).values(rows).onConflictDoNothing();

// ---- lists ----
for (const [index, list] of D.LISTS.entries()) {
  const feedDay = D.FEED.find((item) => item.kind === "list" && item.who === list.by)?.at;
  const created = feedDay ? at(feedDay) : at("2026-02-01", index * 24 * 60);
  const [saved] = await db
    .insert(t.lists)
    .values({
      userId: userId(list.by),
      name: list.name,
      description: list.description,
      visibility: list.visibility,
      createdAt: created,
      updatedAt: created,
    })
    .returning({ id: t.lists.id });
  const items = list.items.flatMap((item, position) => {
    const mediaId = id(item.key);
    return mediaId && saved
      ? {
          listId: saved.id,
          mediaId,
          note: item.note ?? null,
          createdAt: new Date(created.getTime() + position * 60_000),
        }
      : [];
  });
  if (items.length > 0) await db.insert(t.listItems).values(items);
}

// ---- clubs, their picks, and their discussions ----
for (const club of D.CLUBS) {
  const [saved] = await db
    .insert(t.clubs)
    .values({
      ownerId: userId(club.owner),
      name: club.name,
      description: club.description,
      access: club.access === "invite" ? "invite_only" : "public",
      mediaTypes: club.types,
      inviteCode: club.invite ?? `demo-${club.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      createdAt: at("2025-09-01"),
    })
    .returning({ id: t.clubs.id });
  if (!saved) continue;
  const members = [...new Set([club.owner, ...club.members])];
  await db.insert(t.clubMembers).values(
    members.map((username, index) => ({
      clubId: saved.id,
      userId: userId(username),
      createdAt: at("2025-09-01", index),
    })),
  );
  const picks = club.picks.flatMap((pick, index) => {
    const mediaId = id(pick.key);
    // The first pick is the current one: each earlier pick is a few weeks older.
    const when = new Date(at(D.TODAY).getTime() - (index * 28 + 3) * 86_400_000);
    return mediaId ? { clubId: saved.id, mediaId, addedBy: userId(pick.by), createdAt: when } : [];
  });
  if (picks.length > 0) await db.insert(t.clubPicks).values(picks);
  for (const thread of club.threads) {
    const [opening, ...replies] = thread.posts;
    if (!opening) continue;
    const [started] = await db
      .insert(t.clubThreads)
      .values({
        clubId: saved.id,
        authorId: userId(thread.by),
        title: thread.title,
        body: opening.body,
        createdAt: at(thread.at),
        activeAt: at(thread.active, replies.length),
      })
      .returning({ id: t.clubThreads.id });
    if (started && replies.length > 0) {
      await db.insert(t.clubReplies).values(
        replies.map((reply, index) => ({
          threadId: started.id,
          authorId: userId(reply.by),
          body: reply.body,
          createdAt: at(reply.at, index),
        })),
      );
    }
  }
}

// ---- alerts ----
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const alertKinds = {
  mine: "on_my_subscriptions",
  any: "streamable",
  price: "price_at_most",
} as const;
const alertRows = D.ALERTS.flatMap((alert) => {
  const mediaId = id(alert.key);
  if (!mediaId) return [];
  const fired = alert.state === "fired" && alert.fired ? at(alert.fired) : null;
  const outcome = !fired
    ? null
    : alert.kind === "price"
      ? `${money(alert.price ?? 0)} at ${alert.store}`
      : `On ${alert.service}`;
  return {
    userId: me,
    mediaId,
    kind: alertKinds[alert.kind],
    targetCents: alert.kind === "price" ? (alert.target ?? null) : null,
    createdAt: at(alert.set),
    triggeredAt: fired,
    outcome,
    notifiedAt: fired,
  };
});
if (alertRows.length > 0) await db.insert(t.alerts).values(alertRows);

// ---- universes: verified links, and the names reviewers gave them ----
for (const universe of D.UNIVERSES) {
  const links: (typeof t.mediaLinks.$inferInsert)[] = universe.edges.flatMap(
    ([first, second, kind]) => {
      const [earlier, later] = [id(first), id(second)];
      // Both kinds read from the later title to the one it follows or is based on.
      return earlier && later
        ? {
            fromMediaId: later,
            toMediaId: earlier,
            kind: kind === "adapt" ? ("adaptation_of" as const) : ("sequel_of" as const),
            source: "manual" as const,
            verifiedBy: me,
          }
        : [];
    },
  );
  // A title the mockup places in a universe without saying how it relates is simply part of it.
  const joined = new Set(universe.edges.flat());
  const [first] = universe.nodes;
  for (const key of universe.nodes) {
    const [loose, lead] = [id(key), first && id(first)];
    if (joined.has(key) || !loose || !lead || loose === lead) continue;
    links.push({
      fromMediaId: loose,
      toMediaId: lead,
      kind: "same_franchise" as const,
      source: "manual" as const,
      verifiedBy: me,
    });
  }
  if (links.length > 0) await db.insert(t.mediaLinks).values(links).onConflictDoNothing();
  const anchor = universe.nodes.map(id).find(Boolean);
  if (anchor) {
    await db
      .insert(t.universes)
      .values({ mediaId: anchor, name: universe.name, description: universe.blurb, updatedBy: me });
  }
}
// Suggestions wait for review, so one for a pair the mockup already shows as linked is left out.
const sameUniverse = (a: string, b: string) =>
  D.UNIVERSES.some((universe) => universe.nodes.includes(a) && universe.nodes.includes(b));
const suggestionRows = D.SUGGESTIONS.flatMap((suggestion) => {
  const mediaId = id(suggestion.a);
  const target = C[suggestion.b];
  return mediaId && target && !sameUniverse(suggestion.a, suggestion.b)
    ? {
        mediaId,
        targetType: target.type,
        targetProviderId: target.id,
        targetTitle: target.title,
        kind:
          suggestion.relation === "adapt"
            ? ("adaptation_of" as const)
            : ("same_franchise" as const),
        reversed: suggestion.relation === "adapt",
      }
    : [];
});
if (suggestionRows.length > 0) await db.insert(t.linkSuggestions).values(suggestionRows);

// ---- similar titles, which recommendations are made from ----
const summaries = await db
  .select({
    id: t.media.id,
    type: t.media.type,
    providerId: t.media.providerId,
    title: t.media.title,
    releaseYear: t.media.releaseYear,
    posterUrl: t.media.posterUrl,
    backdropUrl: t.media.backdropUrl,
  })
  .from(t.media)
  .where(inArray(t.media.id, [...mediaIds.values()]));
const summaryOf = new Map(summaries.map((summary) => [summary.id, summary]));
for (const row of D.RECOMMENDATIONS) {
  const mediaId = id(row.seed);
  if (!mediaId) continue;
  const similar = row.keys.flatMap((key, position) => {
    const summary = summaryOf.get(id(key) ?? "");
    return summary?.providerId
      ? {
          mediaId,
          position,
          type: summary.type,
          providerId: summary.providerId,
          title: summary.title,
          releaseYear: summary.releaseYear,
          posterUrl: summary.posterUrl,
          backdropUrl: summary.backdropUrl,
        }
      : [];
  });
  if (similar.length > 0) await db.insert(t.similarTitles).values(similar).onConflictDoNothing();
  await db.insert(t.similarChecks).values({ mediaId, checkedAt: new Date() }).onConflictDoNothing();
}

const [counts] = await db
  .select({
    ratings: sql<number>`(select count(*)::int from ${t.ratings})`,
    reviews: sql<number>`(select count(*)::int from ${t.reviews})`,
    entries: sql<number>`(select count(*)::int from ${t.libraryEntries} where ${and(eq(t.libraryEntries.userId, me))})`,
  })
  .from(sql`(select 1) as one`);
console.info(
  `Demo ready: sign in as ${D.ME.email}. ${counts?.entries} library entries, ${counts?.ratings} ratings, ${counts?.reviews} reviews.`,
);
process.exit(0);

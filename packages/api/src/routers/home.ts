import type { Database } from "@yousiverse/db";
import {
  alerts,
  clubMembers,
  clubPicks,
  clubReplies,
  clubs,
  clubThreads,
  episodes,
  follows,
  libraryEntries,
  media,
  mediaTypes,
  profiles,
  ratings,
  reviews,
  seasons,
  streamingOffers,
  streamingServices,
  userSubscriptions,
  users,
} from "@yousiverse/db/schema";
import { and, asc, between, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { addDays, usToday } from "../calendar/dates";
import { progressFor } from "../progress";
import { titleSummary, withPages } from "../titles";
import { isAdmin, protectedProcedure, publicProcedure, router } from "../trpc";
import { visibleToOthers } from "../visibility";

/** How far ahead "coming up" looks: the calendar's own window, which is where it leads. */
const DAYS_AHEAD = 90;
const COMING_UP_SHOWN = 8;
/** The lead is chosen from this many of the most recently touched titles in progress. */
const IN_PROGRESS_CONSIDERED = 12;
const BESIDE_THE_LEAD = 3;
const READY_SHOWN = 12;
const ACTIVITY_SHOWN = 3;
/** Read twice as many of each kind, since a review can stand in for a library change. */
const ACTIVITY_READ = ACTIVITY_SHOWN * 2;
const CAME_THROUGH_SHOWN = 3;
const DISCUSSIONS_SHOWN = 3;
/** The front door's wall has four columns of nine. */
const WALL_TITLES_PER_TYPE = 9;
/** Artwork with less color than this, as a percentage, goes to the back of the wall. */
const COLORFUL_FROM = 25;

/**
 * The color a club is marked with where it is only named: that of its newest pick's artwork,
 * as its tile has it. Only picks of a kind the club still covers, with a page, count.
 */
const newestPickHue = sql<number | null>`(
  select ${media.artHue} from ${clubPicks}
  inner join ${media} on ${media.id} = ${clubPicks.mediaId}
  where ${clubPicks.clubId} = ${clubs.id}
    and ${media.type} = any(${clubs.mediaTypes})
    and ${media.providerId} is not null
  order by ${clubPicks.createdAt} desc, ${media.title}
  limit 1
)`;

/** Keeps the rows whose title has a page, as `withPages` does for rows that are titles. */
function withTitlePages<Row extends { title: { providerId: string | null } }>(rows: Row[]) {
  return rows.flatMap((row) => {
    const [title] = withPages([row.title]);
    return title ? { ...row, title } : [];
  });
}

/**
 * What the person is partway through, most recently touched first. The lead is a show with an
 * episode out and waiting when there is one, because that is the one thing on Home that takes a
 * single click; otherwise it is whatever they touched last.
 */
async function findInProgress(db: Database, userId: string, today: string) {
  const underWay = and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, "in_progress"));
  const [total, recent] = await Promise.all([
    db.$count(libraryEntries, underWay),
    db
      .select({ ...titleSummary, updatedAt: libraryEntries.updatedAt })
      .from(libraryEntries)
      .innerJoin(media, eq(media.id, libraryEntries.mediaId))
      .where(underWay)
      .orderBy(desc(libraryEntries.updatedAt), asc(media.title))
      .limit(IN_PROGRESS_CONSIDERED),
  ]);
  const titles = withPages(recent);
  const progress = await progressFor(
    db,
    userId,
    titles.map((title) => title.mediaId),
  );
  const entries = titles.map((title) => ({
    ...title,
    progress: progress.get(title.mediaId) ?? null,
  }));

  type Entry = (typeof entries)[number];
  const nextEpisodeOf = (entry: Entry) =>
    entry.progress?.kind === "episodes" ? entry.progress.next : null;
  const hasEpisodeOut = (entry: Entry) => {
    const airDate = nextEpisodeOf(entry)?.airDate;
    return typeof airDate === "string" && airDate <= today;
  };
  const lead = entries.find(hasEpisodeOut) ?? entries[0];
  if (!lead) return { total, lead: null, others: [] };

  // Marking the next episode watched needs its id, which the progress does not carry.
  const next = nextEpisodeOf(lead);
  const [nextEpisode] = next
    ? await db
        .select({ id: episodes.id, runtimeMinutes: episodes.runtimeMinutes })
        .from(episodes)
        .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
        .where(
          and(
            eq(seasons.mediaId, lead.mediaId),
            eq(seasons.seasonNumber, next.seasonNumber),
            eq(episodes.episodeNumber, next.episodeNumber),
          ),
        )
    : [];
  return {
    total,
    lead: { ...lead, nextEpisode: nextEpisode ?? null },
    others: entries.filter((entry) => entry !== lead).slice(0, BESIDE_THE_LEAD),
  };
}

/**
 * The next dated thing for each title in the library that is not dropped: a movie's or game's
 * release, or a show's next episode. Soonest first, within the calendar's 90 days.
 */
async function findComingUp(db: Database, userId: string, today: string) {
  const until = addDays(today, DAYS_AHEAD);
  const inLibrary = and(
    isNotNull(media.providerId),
    inArray(
      media.id,
      db
        .select({ mediaId: libraryEntries.mediaId })
        .from(libraryEntries)
        .where(and(eq(libraryEntries.userId, userId), ne(libraryEntries.status, "dropped"))),
    ),
  );

  const [releases, airings] = await Promise.all([
    db
      .select({ title: titleSummary, date: media.releaseDate })
      .from(media)
      .where(and(inLibrary, ne(media.type, "tv"), between(media.releaseDate, today, until)))
      .orderBy(asc(media.releaseDate), asc(media.title))
      .limit(COMING_UP_SHOWN),
    db
      .selectDistinctOn([media.id], {
        title: titleSummary,
        date: episodes.airDate,
        seasonNumber: seasons.seasonNumber,
        episodeNumber: episodes.episodeNumber,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(media, eq(media.id, seasons.mediaId))
      .where(and(inLibrary, between(episodes.airDate, today, until)))
      .orderBy(
        asc(media.id),
        asc(episodes.airDate),
        asc(seasons.seasonNumber),
        asc(episodes.episodeNumber),
      ),
  ]);

  const entries = [
    ...withTitlePages(releases).flatMap(({ date, title }) =>
      date ? { kind: "release" as const, date, title } : [],
    ),
    ...withTitlePages(airings).flatMap(({ date, ...airing }) =>
      date ? { kind: "episode" as const, date, ...airing } : [],
    ),
  ];
  entries.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.title.localeCompare(b.title.title),
  );
  return entries.slice(0, COMING_UP_SHOWN);
}

/**
 * Movies and shows on the want list that one of the person's subscriptions carries, going only
 * by the offers already stored. Nothing is fetched here: availability requests are rationed, so
 * a title whose offers were never looked up is simply left out.
 */
async function findReadyToWatch(db: Database, userId: string) {
  const rows = await db
    .select({
      ...titleSummary,
      service: { name: streamingServices.name, logoUrl: streamingServices.logoUrl },
    })
    .from(libraryEntries)
    .innerJoin(media, eq(media.id, libraryEntries.mediaId))
    .innerJoin(
      streamingOffers,
      and(eq(streamingOffers.mediaId, media.id), eq(streamingOffers.kind, "subscription")),
    )
    .innerJoin(
      userSubscriptions,
      and(
        eq(userSubscriptions.serviceId, streamingOffers.serviceId),
        eq(userSubscriptions.userId, userId),
      ),
    )
    .innerJoin(streamingServices, eq(streamingServices.id, streamingOffers.serviceId))
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.status, "want"),
        inArray(media.type, ["movie", "tv"]),
      ),
    )
    .orderBy(
      desc(libraryEntries.updatedAt),
      asc(media.title),
      sql`${streamingServices.rank} asc nulls last`,
      asc(streamingServices.name),
    );

  // A title on several of the person's services is shown once, with the most widely used.
  const titles = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!titles.has(row.mediaId)) titles.set(row.mediaId, row);
  }
  return withPages([...titles.values()]).slice(0, READY_SHOWN);
}

/**
 * The latest things the people the viewer follows did with a title: library changes and
 * reviews, newest first, under the feed's own rules for who may see what. Someone who finishes
 * a title and then reviews it is shown once, by the review, which says more.
 */
async function findFollowedActivity(db: Database, viewerId: string) {
  const followed = db
    .select({ id: follows.followedId })
    .from(follows)
    .where(eq(follows.followerId, viewerId));

  const [libraryChanges, newReviews] = await Promise.all([
    db
      .select({
        id: libraryEntries.id,
        at: libraryEntries.updatedAt,
        username: profiles.username,
        status: libraryEntries.status,
        // The person's rating of the title, in quarter points.
        rating: ratings.value,
        title: titleSummary,
      })
      .from(libraryEntries)
      .innerJoin(profiles, eq(profiles.userId, libraryEntries.userId))
      .innerJoin(media, eq(media.id, libraryEntries.mediaId))
      .leftJoin(
        ratings,
        and(
          eq(ratings.userId, libraryEntries.userId),
          eq(ratings.mediaId, libraryEntries.mediaId),
          isNull(ratings.episodeId),
        ),
      )
      .where(
        and(
          inArray(libraryEntries.userId, followed),
          visibleToOthers(viewerId, libraryEntries.userId, libraryEntries.visibility),
          isNotNull(media.providerId),
        ),
      )
      .orderBy(desc(libraryEntries.updatedAt))
      .limit(ACTIVITY_READ),
    db
      .select({
        id: reviews.id,
        at: reviews.createdAt,
        username: profiles.username,
        body: reviews.body,
        rating: ratings.value,
        seasonNumber: seasons.seasonNumber,
        episodeNumber: episodes.episodeNumber,
        title: titleSummary,
      })
      .from(reviews)
      .innerJoin(profiles, eq(profiles.userId, reviews.userId))
      .innerJoin(media, eq(media.id, reviews.mediaId))
      .leftJoin(episodes, eq(episodes.id, reviews.episodeId))
      .leftJoin(seasons, eq(seasons.id, episodes.seasonId))
      .leftJoin(
        ratings,
        and(
          eq(ratings.userId, reviews.userId),
          eq(ratings.mediaId, reviews.mediaId),
          sql`${ratings.episodeId} is not distinct from ${reviews.episodeId}`,
        ),
      )
      .where(
        and(
          inArray(reviews.userId, followed),
          visibleToOthers(viewerId, reviews.userId, reviews.visibility),
          isNotNull(media.providerId),
        ),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(ACTIVITY_READ),
  ]);

  const reviewed = withTitlePages(newReviews).map(({ seasonNumber, episodeNumber, ...review }) => ({
    kind: "review" as const,
    ...review,
    /** Set only for a review of one episode. */
    episode:
      seasonNumber !== null && episodeNumber !== null ? { seasonNumber, episodeNumber } : null,
  }));
  const personAndTitle = (item: { username: string; title: { mediaId: string } }) =>
    `${item.username}:${item.title.mediaId}`;
  const reviewedAt = new Map(
    reviewed
      .filter((review) => !review.episode)
      .map((review) => [personAndTitle(review), review.at]),
  );
  const changed = withTitlePages(libraryChanges)
    .filter((change) => {
      const laterReview = reviewedAt.get(personAndTitle(change));
      return !laterReview || laterReview < change.at;
    })
    .map((change) => ({ kind: "library" as const, ...change }));

  const items = [...changed, ...reviewed];
  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, ACTIVITY_SHOWN);
}

/** The person's alerts that have come through, the latest first. */
async function findCameThrough(db: Database, userId: string) {
  const fired = await db
    .select({
      id: alerts.id,
      kind: alerts.kind,
      outcome: alerts.outcome,
      triggeredAt: alerts.triggeredAt,
      title: titleSummary,
    })
    .from(alerts)
    .innerJoin(media, eq(media.id, alerts.mediaId))
    .where(
      and(eq(alerts.userId, userId), isNotNull(alerts.triggeredAt), isNotNull(media.providerId)),
    )
    .orderBy(desc(alerts.triggeredAt), desc(alerts.id))
    .limit(CAME_THROUGH_SHOWN);
  return withTitlePages(fired);
}

/**
 * The most recently active discussions in the clubs the person belongs to. A member may read
 * everything in their club, so being one is the whole check; no other club's discussions show.
 */
function findClubDiscussions(db: Database, userId: string) {
  return db
    .select({
      id: clubThreads.id,
      title: clubThreads.title,
      activeAt: clubThreads.activeAt,
      replyCount: sql<number>`(select count(*)::int from ${clubReplies} where ${clubReplies.threadId} = ${clubThreads.id})`,
      club: { id: clubs.id, name: clubs.name },
    })
    .from(clubThreads)
    .innerJoin(clubs, eq(clubs.id, clubThreads.clubId))
    .innerJoin(clubMembers, and(eq(clubMembers.clubId, clubs.id), eq(clubMembers.userId, userId)))
    .orderBy(desc(clubThreads.activeAt), desc(clubThreads.id))
    .limit(DISCUSSIONS_SHOWN);
}

export const homeRouter = router({
  /**
   * Everything the signed-in person's Home shows, in one answer: what to pick up, what is coming
   * up, what on their want list is already on their services, what the people they follow did
   * lately, the alerts that came through, and their clubs' latest discussions. `librarySize` and
   * `followingCount` say whether there is anything to draw on yet: both are zero for someone
   * new. Dates are US calendar days.
   */
  /**
   * What the frame around every page shows about the signed-in person: their name, the clubs
   * they are in, and how many of their alerts have come through. It runs on every page, so it
   * reads nothing else.
   */
  shell: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [[me], joined, alertsCameThrough] = await Promise.all([
      ctx.db
        .select({ name: users.name, username: profiles.username })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.id, userId)),
      ctx.db
        .select({ id: clubs.id, name: clubs.name, hue: newestPickHue })
        .from(clubs)
        .innerJoin(clubMembers, eq(clubMembers.clubId, clubs.id))
        .where(eq(clubMembers.userId, userId))
        .orderBy(asc(clubs.name)),
      // The alerts page lists only alerts whose title has a page, so only those are counted.
      ctx.db.$count(
        alerts,
        and(
          eq(alerts.userId, userId),
          isNotNull(alerts.triggeredAt),
          sql`exists (select 1 from ${media} where ${media.id} = ${alerts.mediaId} and ${media.providerId} is not null)`,
        ),
      ),
    ]);
    return {
      name: me?.name ?? "",
      /** Null until the person chooses one. */
      username: me?.username ?? null,
      isReviewer: isAdmin(ctx.session),
      clubs: joined,
      alertsCameThrough,
    };
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const today = usToday();
    const [
      librarySize,
      followingCount,
      inProgress,
      comingUp,
      ready,
      activity,
      cameThrough,
      discussions,
    ] = await Promise.all([
      ctx.db.$count(libraryEntries, eq(libraryEntries.userId, userId)),
      ctx.db.$count(follows, eq(follows.followerId, userId)),
      findInProgress(ctx.db, userId, today),
      findComingUp(ctx.db, userId, today),
      findReadyToWatch(ctx.db, userId),
      findFollowedActivity(ctx.db, userId),
      findCameThrough(ctx.db, userId),
      findClubDiscussions(ctx.db, userId),
    ]);
    return {
      today,
      librarySize,
      followingCount,
      inProgress,
      comingUp,
      ready,
      activity,
      cameThrough,
      discussions,
    };
  }),

  /**
   * Artwork for the front door's wall: the latest titles of each type that have a poster, the
   * colorful ones first, dealt out so that every type appears throughout.
   */
  wall: publicProcedure.query(async ({ ctx }) => {
    const byType = await Promise.all(
      mediaTypes.map((type) =>
        ctx.db
          .select(titleSummary)
          .from(media)
          .where(and(eq(media.type, type), isNotNull(media.providerId), isNotNull(media.posterUrl)))
          .orderBy(
            sql`coalesce(${media.artSaturation}, 0) > ${COLORFUL_FROM} desc`,
            desc(media.createdAt),
            asc(media.id),
          )
          .limit(WALL_TITLES_PER_TYPE),
      ),
    );
    const dealt = Array.from({ length: WALL_TITLES_PER_TYPE }, (_, round) =>
      byType.flatMap((titles) => titles[round] ?? []),
    ).flat();
    return withPages(dealt);
  }),
});

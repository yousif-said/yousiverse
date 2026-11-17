import { randomBytes } from "node:crypto";
import { env as authEnv } from "@yousiverse/auth/env";
import type { Database } from "@yousiverse/db";
import {
  alerts,
  availabilityChecks,
  emailPreferences,
  games,
  media,
  users,
} from "@yousiverse/db/schema";
import { EmailLimitError, remainingToday, sendEmail } from "@yousiverse/email";
import { and, asc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { ensureGamePrices } from "../availability/game-prices";
import { ensureStreamingOffers } from "../availability/streaming";
import { findMetAlerts } from "./conditions";
import { alertsEmail } from "./email";

const HOUR_MS = 60 * 60 * 1000;
/** A daily run refreshes what was last fetched before the previous run, allowing for a late start. */
const REFRESH_OLDER_THAN_MS = 20 * HOUR_MS;
/**
 * Watchmode allows 2,500 requests a month, and pages people open use some. Sixty a day leaves
 * room for them. With more titles than this waiting, each is simply refreshed less often.
 */
export const STREAMING_REFRESHES_PER_RUN = 60;
export const GAME_REFRESHES_PER_RUN = 100;
export const PEOPLE_PER_BATCH = 10;

export type TitleToRefresh =
  | { id: string; type: "movie" | "tv"; providerId: string }
  | { id: string; type: "game"; steamAppId: string | null };

/**
 * The titles someone is waiting on whose availability or prices are due a refresh, the longest
 * unchecked first, within the day's budget for each provider.
 */
export async function findTitlesToRefresh(db: Database): Promise<TitleToRefresh[]> {
  const stale = or(
    isNull(availabilityChecks.checkedAt),
    lt(availabilityChecks.checkedAt, new Date(Date.now() - REFRESH_OLDER_THAN_MS)),
  );
  const awaited = inArray(
    media.id,
    db.select({ mediaId: alerts.mediaId }).from(alerts).where(isNull(alerts.triggeredAt)),
  );
  const oldestFirst = [sql`${availabilityChecks.checkedAt} asc nulls first`, asc(media.id)];

  const [streaming, priced] = await Promise.all([
    db
      .select({ id: media.id, type: media.type, providerId: media.providerId })
      .from(media)
      .leftJoin(availabilityChecks, eq(availabilityChecks.mediaId, media.id))
      .where(
        and(
          awaited,
          stale,
          inArray(media.type, ["movie", "tv"]),
          eq(media.provider, "tmdb"),
          isNotNull(media.providerId),
        ),
      )
      .orderBy(...oldestFirst)
      .limit(STREAMING_REFRESHES_PER_RUN),
    db
      .select({ id: media.id, steamAppId: games.steamAppId })
      .from(media)
      .innerJoin(games, eq(games.mediaId, media.id))
      .leftJoin(availabilityChecks, eq(availabilityChecks.mediaId, media.id))
      .where(and(awaited, stale))
      .orderBy(...oldestFirst)
      .limit(GAME_REFRESHES_PER_RUN),
  ]);

  return [
    ...streaming.flatMap((title) =>
      (title.type === "movie" || title.type === "tv") && title.providerId
        ? { id: title.id, type: title.type, providerId: title.providerId }
        : [],
    ),
    ...priced.map((game) => ({ ...game, type: "game" as const })),
  ];
}

/**
 * Fetches fresh availability or prices for some titles. A provider failing on one title is
 * logged and counted, and leaves that title due again next time.
 */
export async function refreshTitles(db: Database, titles: TitleToRefresh[]) {
  const result = { refreshed: 0, failed: 0 };
  for (const title of titles) {
    const check =
      title.type === "game"
        ? await ensureGamePrices(db, title, REFRESH_OLDER_THAN_MS)
        : await ensureStreamingOffers(db, title, REFRESH_OLDER_THAN_MS);
    if (check && !check.outOfDate) result.refreshed += 1;
    else result.failed += 1;
  }
  return result;
}

/** Marks every waiting alert that has come true as triggered. Returns how many. */
export async function triggerMetAlerts(db: Database): Promise<number> {
  const met = await findMetAlerts(db);
  const triggeredAt = new Date();
  for (const { alertId, outcome } of met) {
    await db
      .update(alerts)
      .set({ triggeredAt, outcome })
      .where(and(eq(alerts.id, alertId), isNull(alerts.triggeredAt)));
  }
  return met.length;
}

const newUnsubscribeToken = () => randomBytes(24).toString("base64url");

/** A person's email settings, created with alert emails on the first time they are needed. */
export async function ensureEmailPreferences(db: Database, userId: string) {
  await db
    .insert(emailPreferences)
    .values({ userId, unsubscribeToken: newUnsubscribeToken() })
    .onConflictDoNothing({ target: emailPreferences.userId });
  const [preferences] = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId));
  if (!preferences) throw new Error(`No email preferences for user ${userId}.`);
  return preferences;
}

type Notified = "emailed" | "muted" | "deferred";

/**
 * Tells one person about their alerts that came through and have not been reported yet, in a
 * single email. Someone who turned alert emails off is told nothing, and their alerts are
 * settled. When the day's emails have run out the alerts stay unreported for the next run.
 */
async function notifyPerson(db: Database, userId: string): Promise<Notified> {
  const [pending, preferences, [user]] = await Promise.all([
    db
      .select({
        id: alerts.id,
        outcome: alerts.outcome,
        title: media.title,
        type: media.type,
        providerId: media.providerId,
      })
      .from(alerts)
      .innerJoin(media, eq(media.id, alerts.mediaId))
      .where(
        and(eq(alerts.userId, userId), isNotNull(alerts.triggeredAt), isNull(alerts.notifiedAt)),
      )
      .orderBy(asc(media.title), asc(alerts.id)),
    ensureEmailPreferences(db, userId),
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)),
  ]);
  const settle = () =>
    db
      .update(alerts)
      .set({ notifiedAt: new Date() })
      .where(
        inArray(
          alerts.id,
          pending.map((alert) => alert.id),
        ),
      );

  const news = pending.flatMap(({ outcome, providerId, title, type }) =>
    outcome && providerId ? { outcome, providerId, title, type } : [],
  );
  if (!user || !preferences.alertEmails || news.length === 0) {
    if (pending.length > 0) await settle();
    return "muted";
  }

  try {
    await sendEmail(db, {
      to: user.email,
      kind: "alerts",
      content: alertsEmail(news, {
        origin: authEnv.BETTER_AUTH_URL,
        unsubscribeToken: preferences.unsubscribeToken,
      }),
    });
  } catch (error) {
    if (error instanceof EmailLimitError) return "deferred";
    throw error;
  }
  await settle();
  return "emailed";
}

/**
 * Reports to the next few people with alerts waiting to be reported. `finished` is true once
 * nobody is left, or no more email can go out today. Throws a ProviderError when the email
 * service fails, having told nobody twice.
 */
export async function notifyNextPeople(db: Database) {
  const result = { emailed: 0, muted: 0, finished: false };
  if ((await remainingToday(db, "alerts")) === 0) {
    // Only people who turned emails off can still be settled; do that, then stop.
    const muted = await db
      .selectDistinct({ userId: alerts.userId })
      .from(alerts)
      .innerJoin(emailPreferences, eq(emailPreferences.userId, alerts.userId))
      .where(
        and(
          isNotNull(alerts.triggeredAt),
          isNull(alerts.notifiedAt),
          eq(emailPreferences.alertEmails, false),
        ),
      )
      .limit(PEOPLE_PER_BATCH);
    for (const { userId } of muted) await notifyPerson(db, userId);
    return { ...result, muted: muted.length, finished: muted.length === 0 };
  }

  const people = await db
    .selectDistinct({ userId: alerts.userId })
    .from(alerts)
    .where(and(isNotNull(alerts.triggeredAt), isNull(alerts.notifiedAt)))
    .orderBy(asc(alerts.userId))
    .limit(PEOPLE_PER_BATCH);
  for (const { userId } of people) {
    const outcome = await notifyPerson(db, userId);
    if (outcome === "deferred") return { ...result, finished: true };
    result[outcome] += 1;
  }
  return { ...result, finished: people.length < PEOPLE_PER_BATCH };
}

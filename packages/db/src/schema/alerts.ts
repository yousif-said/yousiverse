import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media } from "./media";

// What a person asks to be told about: a movie or show reaching a service they subscribe to,
// or becoming streamable at all; a game's price falling to an amount they named.
export const alertKinds = ["on_my_subscriptions", "streamable", "price_at_most"] as const;
export type AlertKind = (typeof alertKinds)[number];

export const alertKind = pgEnum("alert_kind", alertKinds);

/**
 * One thing a person asked to be told about a title. An alert fires once: when what it waits
 * for comes true it is marked as triggered, and stays as a record until its owner removes it or
 * sets it again.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    kind: alertKind().notNull(),
    // For a price alert: the most the person wants to pay, in cents.
    targetCents: integer(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    // When what the alert waits for was found to be true. Null while it is still waiting.
    triggeredAt: timestamp({ withTimezone: true }),
    // What was found, in words ready to show: "On Netflix", "$9.99 at Steam".
    outcome: text(),
    // When the person was emailed about it, or it was settled that they would not be.
    notifiedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique().on(table.userId, table.mediaId, table.kind),
    // The daily check reads the alerts still waiting, by title.
    index().on(table.mediaId, table.triggeredAt),
    check(
      "alerts_price_has_target",
      sql`(${table.kind} = 'price_at_most') = (${table.targetCents} is not null)`,
    ),
    check("alerts_target_positive", sql`${table.targetCents} is null or ${table.targetCents} > 0`),
  ],
);

/** Whether a person wants alerts by email, and the secret in their one-click unsubscribe link. */
export const emailPreferences = pgTable("email_preferences", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  alertEmails: boolean().notNull().default(true),
  unsubscribeToken: text().notNull().unique(),
});

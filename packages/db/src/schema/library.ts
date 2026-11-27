import { sql } from "drizzle-orm";
import {
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
import { episodes, media } from "./media";

export const libraryStatuses = ["want", "in_progress", "finished", "dropped"] as const;
export type LibraryStatus = (typeof libraryStatuses)[number];

export const libraryStatus = pgEnum("library_status", libraryStatuses);

/**
 * Who can see a piece of user content: everyone, only the owner's friends (people the owner
 * follows who follow them back), or only the owner.
 */
export const visibilities = ["public", "friends", "private"] as const;
export type Visibility = (typeof visibilities)[number];

export const visibility = pgEnum("visibility", visibilities);

export const libraryEntries = pgTable(
  "library_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    status: libraryStatus().notNull(),
    visibility: visibility().notNull().default("public"),
    // How far through the person is. Books count pages and games count minutes; a show's
    // progress is its watched episodes, in `episode_watches`.
    pagesRead: integer(),
    minutesPlayed: integer(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique().on(table.userId, table.mediaId),
    check("library_entries_pages_read_positive", sql`${table.pagesRead} >= 0`),
    check("library_entries_minutes_played_positive", sql`${table.minutesPlayed} >= 0`),
  ],
);

/** An episode a person has watched. Only ever shown to that person. */
export const episodeWatches = pgTable(
  "episode_watches",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: uuid()
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.episodeId), index().on(table.episodeId)],
);

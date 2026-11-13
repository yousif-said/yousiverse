import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media } from "./media";

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
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.userId, table.mediaId)],
);

import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * One person following another. Following needs no approval. Two people who follow each other
 * are friends.
 */
export const follows = pgTable(
  "follows",
  {
    id: uuid().primaryKey().defaultRandom(),
    followerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.followerId, table.followedId),
    // A person's followers are read by who is followed.
    index().on(table.followedId),
    check("follows_not_self", sql`${table.followerId} <> ${table.followedId}`),
  ],
);

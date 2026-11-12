import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { visibility } from "./library";
import { media } from "./media";

/** A named collection of titles of any type, made by one person. */
export const lists = pgTable(
  "lists",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    visibility: visibility().notNull().default("public"),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index().on(table.userId)],
);

export const listItems = pgTable(
  "list_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    listId: uuid()
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    // Items are shown in the order they were added.
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.listId, table.mediaId)],
);

import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { visibility } from "./library";
import { episodes, media } from "./media";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The title reviewed. A review of one episode names its show here and the episode below.
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    episodeId: uuid().references(() => episodes.id, { onDelete: "cascade" }),
    body: text().notNull(),
    visibility: visibility().notNull().default("public"),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // One review per person for a title, and one per person for each of its episodes.
    unique().on(table.userId, table.mediaId, table.episodeId).nullsNotDistinct(),
    index().on(table.mediaId, table.episodeId),
  ],
);

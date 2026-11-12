import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { episodes, media } from "./media";

/** The highest rating, in quarter points: 40 is shown as 10. */
export const MAX_RATING = 40;

export const ratings = pgTable(
  "ratings",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The title rated. A rating of one episode names its show here and the episode below.
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    episodeId: uuid().references(() => episodes.id, { onDelete: "cascade" }),
    // Quarter points, 0 to 40.
    value: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // One rating per person for a title, and one per person for each of its episodes.
    unique().on(table.userId, table.mediaId, table.episodeId).nullsNotDistinct(),
    // Averages are read by title and by episode.
    index().on(table.mediaId, table.episodeId),
    check("ratings_value_range", sql`${table.value} between 0 and ${sql.raw(String(MAX_RATING))}`),
  ],
);

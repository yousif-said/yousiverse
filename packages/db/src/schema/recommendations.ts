import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { media, mediaType } from "./media";

/**
 * A title the provider says is like another, kept as the provider described it: it may not be
 * in the catalog yet. Replaced wholesale each time the list is fetched.
 */
export const similarTitles = pgTable(
  "similar_titles",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    // Where the provider ranked it, best match first, from 0.
    position: integer().notNull(),
    type: mediaType().notNull(),
    providerId: text().notNull(),
    title: text().notNull(),
    releaseYear: integer(),
    posterUrl: text(),
  },
  (table) => [
    unique().on(table.mediaId, table.type, table.providerId),
    index().on(table.mediaId, table.position),
  ],
);

/** When a title's similar titles were last fetched. */
export const similarChecks = pgTable("similar_checks", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  checkedAt: timestamp({ withTimezone: true }).notNull(),
});

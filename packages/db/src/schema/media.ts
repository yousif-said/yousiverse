import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const mediaTypes = ["movie", "tv", "game", "book"] as const;
export type MediaType = (typeof mediaTypes)[number];

export const mediaType = pgEnum("media_type", mediaTypes);

// Shared base record for every catalog item. Type-specific detail tables hang off this.
export const media = pgTable("media", {
  id: uuid().primaryKey().defaultRandom(),
  type: mediaType().notNull(),
  title: text().notNull(),
  releaseYear: integer(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

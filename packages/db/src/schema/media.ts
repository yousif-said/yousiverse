import { date, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const mediaTypes = ["movie", "tv", "game", "book"] as const;
export type MediaType = (typeof mediaTypes)[number];

export const mediaType = pgEnum("media_type", mediaTypes);

export const providers = ["tmdb", "igdb", "open_library"] as const;
export type Provider = (typeof providers)[number];

export const provider = pgEnum("provider", providers);

// Shared base record for every catalog item. Type-specific detail tables hang off this.
export const media = pgTable(
  "media",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: mediaType().notNull(),
    title: text().notNull(),
    overview: text(),
    releaseDate: date(),
    releaseYear: integer(),
    posterUrl: text(),
    backdropUrl: text(),
    genres: text().array().notNull().default([]),
    // Where the item came from. Null for items that were not imported from a provider.
    provider: provider(),
    providerId: text(),
    // When provider data was last copied in. Null until the full details have been fetched.
    syncedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.provider, table.type, table.providerId)],
);

export const movies = pgTable("movies", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  tagline: text(),
  runtimeMinutes: integer(),
});

export const games = pgTable("games", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  platforms: text().array().notNull().default([]),
  developers: text().array().notNull().default([]),
  publishers: text().array().notNull().default([]),
  // The game's id on Steam, used to find its prices. Null when it is not sold there.
  steamAppId: text(),
});

export const books = pgTable("books", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  authors: text().array().notNull().default([]),
  pageCount: integer(),
});

export const tvShows = pgTable("tv_shows", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  tagline: text(),
  status: text(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    seasonNumber: integer().notNull(),
    name: text().notNull(),
    overview: text(),
    airDate: date(),
    posterUrl: text(),
  },
  (table) => [unique().on(table.mediaId, table.seasonNumber)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: uuid().primaryKey().defaultRandom(),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    episodeNumber: integer().notNull(),
    name: text().notNull(),
    overview: text(),
    airDate: date(),
    runtimeMinutes: integer(),
    stillUrl: text(),
  },
  (table) => [unique().on(table.seasonId, table.episodeNumber)],
);

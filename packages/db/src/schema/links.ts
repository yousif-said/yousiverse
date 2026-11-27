import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media, mediaType } from "./media";

// Each kind reads from one title to the other: "from is an adaptation of to", "from is a sequel
// of to". Titles in the same franchise have no direction.
export const linkKinds = ["adaptation_of", "sequel_of", "same_franchise"] as const;
export type LinkKind = (typeof linkKinds)[number];

export const linkKind = pgEnum("link_kind", linkKinds);

export const linkSources = ["wikidata", "manual"] as const;
export type LinkSource = (typeof linkSources)[number];

export const linkSource = pgEnum("link_source", linkSources);

/**
 * A connection between two titles that a reviewer has verified. Everything in this table is
 * shown in the app; suggestions wait in `link_suggestions` until someone approves them.
 */
export const mediaLinks = pgTable(
  "media_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    fromMediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    toMediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    kind: linkKind().notNull(),
    source: linkSource().notNull(),
    verifiedBy: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("media_links_not_self", sql`${table.fromMediaId} <> ${table.toMediaId}`),
    // Two titles are linked at most once, whichever way round the link is stored.
    uniqueIndex("media_links_pair_unique").on(
      sql`least(${table.fromMediaId}, ${table.toMediaId})`,
      sql`greatest(${table.fromMediaId}, ${table.toMediaId})`,
    ),
    index().on(table.toMediaId),
  ],
);

export const suggestionStates = ["pending", "approved", "rejected"] as const;
export type SuggestionState = (typeof suggestionStates)[number];

export const suggestionState = pgEnum("suggestion_state", suggestionStates);

/**
 * A link Wikidata suggests for a title, hidden until a reviewer decides on it. The other title
 * is named by its provider id because it may not be in the catalog yet. Decided suggestions are
 * kept so the same one is not raised again.
 */
export const linkSuggestions = pgTable(
  "link_suggestions",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    targetType: mediaType().notNull(),
    targetProviderId: text().notNull(),
    targetTitle: text().notNull(),
    kind: linkKind().notNull(),
    // True when the link reads from the target to this title: the target is the adaptation or
    // the sequel.
    reversed: boolean().notNull().default(false),
    state: suggestionState().notNull().default("pending"),
    reviewedBy: text().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.mediaId, table.targetType, table.targetProviderId),
    index().on(table.state, table.createdAt),
  ],
);

/**
 * A name and a line of description for a universe: every title joined to `mediaId` through
 * verified links. Written by reviewers. A universe without one goes by its oldest title's name.
 */
export const universes = pgTable("universes", {
  id: uuid().primaryKey().defaultRandom(),
  // Any one title of the universe. The name follows it, whatever else is linked later.
  mediaId: uuid()
    .notNull()
    .unique()
    .references(() => media.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  updatedBy: text().references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** When a title was last looked up for suggested links. */
export const linkChecks = pgTable("link_checks", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  checkedAt: timestamp({ withTimezone: true }).notNull(),
});

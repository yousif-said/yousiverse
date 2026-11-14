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
import { libraryStatus, visibility } from "./library";
import { media, mediaType } from "./media";
import { MAX_RATING } from "./ratings";

export const importSources = [
  "letterboxd",
  "imdb",
  "goodreads",
  "storygraph",
  "steam",
  "trakt",
] as const;
export type ImportSource = (typeof importSources)[number];

export const importSource = pgEnum("import_source", importSources);

/**
 * Where an imported row stands: waiting to be matched to a title, added to the library,
 * matched but with nothing new to add, not matched to any title, or failed for another reason.
 */
export const importItemStates = ["pending", "imported", "already", "not_found", "failed"] as const;
export type ImportItemState = (typeof importItemStates)[number];

export const importItemState = pgEnum("import_item_state", importItemStates);

/** The kind of id a row carries from the place it was exported from. */
export const externalIdKinds = ["imdb", "tmdb", "isbn", "steam"] as const;
export type ExternalIdKind = (typeof externalIdKinds)[number];

export const externalIdKind = pgEnum("external_id_kind", externalIdKinds);

/** One import of a person's history from another service. */
export const imports = pgTable(
  "imports",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: importSource().notNull(),
    // Who can see the library entries and reviews this import creates.
    visibility: visibility().notNull(),
    // Rows in the uploaded data that were left out because the app has no place for them.
    skippedCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index().on(table.userId)],
);

/** One title in an import, matched to the catalog and added to the library one at a time. */
export const importItems = pgTable(
  "import_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    importId: uuid()
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    type: mediaType().notNull(),
    title: text().notNull(),
    year: integer(),
    // A book's author, to tell apart books that share a title.
    creator: text(),
    // The title's id where it was exported from. Null when only its name is known.
    externalId: text(),
    externalKind: externalIdKind(),
    status: libraryStatus(),
    // Quarter points, 0 to 40, like `ratings.value`.
    rating: integer(),
    review: text(),
    state: importItemState().notNull().default("pending"),
    // The catalog title the row was matched to.
    mediaId: uuid().references(() => media.id, { onDelete: "set null" }),
  },
  (table) => [
    unique().on(table.importId, table.position),
    index().on(table.importId, table.state),
    check(
      "import_items_rating_range",
      sql`${table.rating} between 0 and ${sql.raw(String(MAX_RATING))}`,
    ),
  ],
);

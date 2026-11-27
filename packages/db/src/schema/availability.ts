import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media } from "./media";

export const offerKinds = ["subscription", "free", "tv_provider", "rent", "buy"] as const;
export type OfferKind = (typeof offerKinds)[number];

export const offerKind = pgEnum("offer_kind", offerKinds);

/** A streaming service or video store, as Watchmode knows it. */
export const streamingServices = pgTable("streaming_services", {
  id: uuid().primaryKey().defaultRandom(),
  watchmodeId: integer().notNull().unique(),
  name: text().notNull(),
  // The service's own logo, a small square image on Watchmode's CDN. Null until listed with one.
  logoUrl: text(),
  // True for services people pay a subscription for, which they can say they have.
  subscription: boolean().notNull().default(false),
  // Position in Watchmode's list of US services, most widely used first. Null for a service
  // seen only on a title's offers.
  rank: integer(),
  // When the service was last seen in that list.
  listedAt: timestamp({ withTimezone: true }),
});

/** The subscriptions a person says they have. Only ever shown to that person. */
export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: uuid()
      .notNull()
      .references(() => streamingServices.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.serviceId)],
);

/** One way to watch a movie or TV show in the US. Replaced wholesale on every check. */
export const streamingOffers = pgTable(
  "streaming_offers",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    serviceId: uuid()
      .notNull()
      .references(() => streamingServices.id, { onDelete: "cascade" }),
    kind: offerKind().notNull(),
    // Null for subscriptions and free services. For a TV show, the price of one episode.
    priceCents: integer(),
    url: text().notNull(),
  },
  (table) => [unique().on(table.mediaId, table.serviceId, table.kind)],
);

/** When a title's offers were last fetched, so a title with no offers is not fetched again. */
export const availabilityChecks = pgTable("availability_checks", {
  mediaId: uuid()
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  checkedAt: timestamp({ withTimezone: true }).notNull(),
  // Games only: the lowest price the game has ever had in any PC store.
  lowestPriceCents: integer(),
});

/** One PC store's current US price for a game. Replaced wholesale on every check. */
export const gameDeals = pgTable(
  "game_deals",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    shop: text().notNull(),
    priceCents: integer().notNull(),
    // The price without any discount. Equal to `priceCents` when the game is not on sale.
    regularPriceCents: integer().notNull(),
    url: text().notNull(),
  },
  (table) => [unique().on(table.mediaId, table.shop)],
);

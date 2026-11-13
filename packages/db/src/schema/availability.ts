import { integer, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { media } from "./media";

export const offerKinds = ["subscription", "free", "tv_provider", "rent", "buy"] as const;
export type OfferKind = (typeof offerKinds)[number];

export const offerKind = pgEnum("offer_kind", offerKinds);

/** A streaming service or video store, as Watchmode knows it. */
export const streamingServices = pgTable("streaming_services", {
  id: uuid().primaryKey().defaultRandom(),
  watchmodeId: integer().notNull().unique(),
  name: text().notNull(),
});

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
});

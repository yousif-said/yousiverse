import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { media, mediaType } from "./media";

/** Who may join a club: anyone, or only people given its invite link. */
export const clubAccessLevels = ["public", "invite_only"] as const;
export type ClubAccess = (typeof clubAccessLevels)[number];

export const clubAccess = pgEnum("club_access", clubAccessLevels);

/** A group of people around some kinds of media: a book club, a film and TV club. */
export const clubs = pgTable(
  "clubs",
  {
    id: uuid().primaryKey().defaultRandom(),
    // The person who made the club and runs it. The club goes when their account does.
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    access: clubAccess().notNull(),
    // The media types the club covers. Everything the club shows is limited to these.
    mediaTypes: mediaType().array().notNull(),
    // The secret in the club's invite link. Changing it stops the old link working.
    inviteCode: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check("clubs_media_types_not_empty", sql`cardinality(${table.mediaTypes}) > 0`)],
);

/** A person in a club. The club's owner has a row here too. */
export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid().primaryKey().defaultRandom(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.clubId, table.userId), index().on(table.userId)],
);

/** A title a club has chosen. Always one of the media types the club covers. */
export const clubPicks = pgTable(
  "club_picks",
  {
    id: uuid().primaryKey().defaultRandom(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    // The member who picked it. The pick stays if they leave or delete their account.
    addedBy: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.clubId, table.mediaId)],
);

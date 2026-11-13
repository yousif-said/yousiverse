import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * The public side of an account. A person has no profile until they choose a username, and
 * until then nothing they post is credited to them by name.
 */
export const profiles = pgTable("profiles", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Lowercase letters, digits, and underscores. Used in the profile's address: /u/<username>.
  username: text().notNull().unique(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

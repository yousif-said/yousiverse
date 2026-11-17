import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const emailKinds = ["sign_in", "alerts"] as const;
export type EmailKind = (typeof emailKinds)[number];

export const emailKind = pgEnum("email_kind", emailKinds);

/**
 * Each email the app sent in the last few days, kept only to limit how many go out: to one
 * address, and in all. Older rows are deleted as new ones are added.
 */
export const sentEmails = pgTable(
  "sent_emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    // The address written to, in lowercase.
    recipient: text().notNull(),
    kind: emailKind().notNull(),
    sentAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index().on(table.recipient, table.sentAt), index().on(table.sentAt)],
);

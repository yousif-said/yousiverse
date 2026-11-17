import type { Database } from "@yousiverse/db";
import { type EmailKind, sentEmails } from "@yousiverse/db/schema";
import { sendEmail as sendThroughResend } from "@yousiverse/integrations/resend";
import { and, count, eq, gte, lt } from "drizzle-orm";
import type { EmailContent } from "./layout";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Resend's free plan sends 100 emails a day. Stopping short of it keeps the account in good
 * standing, and holding alerts to part of it means sign-in links can still go out.
 */
export const DAILY_LIMIT = 95;
export const ALERTS_DAILY_LIMIT = 60;
/** How many sign-in links one address can be sent in a quarter of an hour. */
export const SIGN_IN_LIMIT = 3;
export const SIGN_IN_WINDOW_MS = 15 * MINUTE_MS;
// The limits look back a day at most, so nothing older needs keeping.
const KEEP_LOG_MS = 2 * DAY_MS;

export type EmailLimit = "address" | "daily";

/** Thrown instead of sending when a limit has been reached. */
export class EmailLimitError extends Error {
  constructor(readonly limit: EmailLimit) {
    super(`Email not sent: the ${limit} limit has been reached.`);
    this.name = "EmailLimitError";
  }
}

/** How many more emails of a kind may go out today, whoever they are for. */
export async function remainingToday(db: Database, kind: EmailKind): Promise<number> {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const [[all], [ofKind]] = await Promise.all([
    db.select({ total: count() }).from(sentEmails).where(gte(sentEmails.sentAt, dayAgo)),
    db
      .select({ total: count() })
      .from(sentEmails)
      .where(and(gte(sentEmails.sentAt, dayAgo), eq(sentEmails.kind, kind))),
  ]);
  const left = DAILY_LIMIT - (all?.total ?? 0);
  return Math.max(
    0,
    kind === "alerts" ? Math.min(left, ALERTS_DAILY_LIMIT - (ofKind?.total ?? 0)) : left,
  );
}

/**
 * Sends one email and records that it went, unless that would pass a limit: three sign-in
 * links to one address in 15 minutes, or the day's total. Throws EmailLimitError then, and a
 * ProviderError when the email service fails.
 */
export async function sendEmail(
  db: Database,
  email: { to: string; kind: EmailKind; content: EmailContent },
): Promise<void> {
  const recipient = email.to.trim().toLowerCase();

  if (email.kind === "sign_in") {
    const [recent] = await db
      .select({ total: count() })
      .from(sentEmails)
      .where(
        and(
          eq(sentEmails.recipient, recipient),
          eq(sentEmails.kind, "sign_in"),
          gte(sentEmails.sentAt, new Date(Date.now() - SIGN_IN_WINDOW_MS)),
        ),
      );
    if ((recent?.total ?? 0) >= SIGN_IN_LIMIT) throw new EmailLimitError("address");
  }
  if ((await remainingToday(db, email.kind)) === 0) throw new EmailLimitError("daily");

  if (process.env.NODE_ENV === "development") {
    // Nothing is emailed from a developer's machine; the message is shown in the terminal.
    console.info(`\nEmail to ${recipient}: ${email.content.subject}\n${email.content.text}\n`);
  } else {
    await sendThroughResend({ to: recipient, ...email.content });
  }
  await db.insert(sentEmails).values({ recipient, kind: email.kind });
  await db.delete(sentEmails).where(lt(sentEmails.sentAt, new Date(Date.now() - KEEP_LOG_MS)));
}

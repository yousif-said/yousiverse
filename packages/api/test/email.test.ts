import { sendSignInEmail, signInEmail } from "@yousiverse/auth/sign-in-email";
import { db } from "@yousiverse/db";
import { sentEmails } from "@yousiverse/db/schema";
import {
  ALERTS_DAILY_LIMIT,
  DAILY_LIMIT,
  EmailLimitError,
  remainingToday,
  renderEmail,
  sendEmail,
} from "@yousiverse/email";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const content = renderEmail({ subject: "Hi", heading: "Hi", paragraphs: ["Hello."] });
const MINUTE_MS = 60 * 1000;

/** Records emails as already sent, some minutes ago. */
async function alreadySent(
  howMany: number,
  kind: "sign_in" | "alerts",
  minutesAgo: number,
  recipient?: string,
) {
  await db.insert(sentEmails).values(
    Array.from({ length: howMany }, (_, index) => ({
      recipient: recipient ?? `person${index}@example.com`,
      kind,
      sentAt: new Date(Date.now() - minutesAgo * MINUTE_MS),
    })),
  );
}

describe("sendEmail", () => {
  beforeEach(async () => {
    await db.delete(sentEmails);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends and records the email, with the address in lowercase", async () => {
    await sendEmail(db, { to: " Ada@Example.com ", kind: "sign_in", content });

    expect(await db.select().from(sentEmails)).toMatchObject([
      { recipient: "ada@example.com", kind: "sign_in" },
    ]);
  });

  it("stops at three sign-in links to one address in 15 minutes", async () => {
    await alreadySent(3, "sign_in", 14, "ada@example.com");

    await expect(
      sendEmail(db, { to: "ADA@example.com", kind: "sign_in", content }),
    ).rejects.toMatchObject({ limit: "address" });
    // Another address is not held back, and neither is this one once the links are older.
    await sendEmail(db, { to: "grace@example.com", kind: "sign_in", content });
    await db.delete(sentEmails);
    await alreadySent(3, "sign_in", 16, "ada@example.com");
    await sendEmail(db, { to: "ada@example.com", kind: "sign_in", content });

    expect(await db.select().from(sentEmails)).toHaveLength(4);
  });

  it("does not count alert emails against the sign-in links for an address", async () => {
    await alreadySent(5, "alerts", 5, "ada@example.com");

    await sendEmail(db, { to: "ada@example.com", kind: "sign_in", content });

    expect(await db.select().from(sentEmails)).toHaveLength(6);
  });

  it("stops everything at the day's limit", async () => {
    await alreadySent(DAILY_LIMIT, "sign_in", 60);

    const refused = await sendEmail(db, { to: "ada@example.com", kind: "sign_in", content }).catch(
      (error) => error,
    );

    expect(refused).toBeInstanceOf(EmailLimitError);
    expect(refused).toMatchObject({ limit: "daily" });
    expect(await remainingToday(db, "sign_in")).toBe(0);
    expect(await remainingToday(db, "alerts")).toBe(0);
  });

  it("holds alerts to part of the day's limit, leaving room for sign-in links", async () => {
    await alreadySent(ALERTS_DAILY_LIMIT, "alerts", 60);

    expect(await remainingToday(db, "alerts")).toBe(0);
    expect(await remainingToday(db, "sign_in")).toBe(DAILY_LIMIT - ALERTS_DAILY_LIMIT);
    await expect(
      sendEmail(db, { to: "ada@example.com", kind: "alerts", content }),
    ).rejects.toMatchObject({ limit: "daily" });
    await sendEmail(db, { to: "ada@example.com", kind: "sign_in", content });
  });

  it("counts only the last 24 hours, and forgets what is older than two days", async () => {
    await alreadySent(DAILY_LIMIT, "sign_in", 25 * 60);
    await alreadySent(4, "alerts", 49 * 60);

    await sendEmail(db, { to: "ada@example.com", kind: "sign_in", content });

    expect(await remainingToday(db, "sign_in")).toBe(DAILY_LIMIT - 1);
    const kept = await db.select().from(sentEmails);
    expect(kept).toHaveLength(DAILY_LIMIT + 1);
    expect(kept.some((row) => row.kind === "alerts")).toBe(false);
  });

  it("records nothing when the email service refuses", async () => {
    vi.stubEnv("PROVIDER_FIXTURES", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 500 })),
    );

    await expect(
      sendEmail(db, { to: "ada@example.com", kind: "sign_in", content }),
    ).rejects.toMatchObject({ provider: "resend" });
    expect(await db.select().from(sentEmails)).toHaveLength(0);
  });
});

describe("sign-in email", () => {
  beforeEach(async () => {
    await db.delete(sentEmails);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("carries the link as a button and as plain text, and says when it expires", () => {
    const url = "https://yousiverse.com/api/auth/magic-link/verify?token=abc&callbackURL=%2F";
    const { subject, html, text } = signInEmail(url);

    expect(subject).toBe("Your Yousiverse sign-in link");
    expect(html).toContain(
      'href="https://yousiverse.com/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
    );
    expect(text).toContain(`Sign in: ${url}`);
    expect(text).toContain("expires in 10 minutes");
  });

  it("sends the link and records it", async () => {
    await sendSignInEmail("ada@example.com", "https://yousiverse.com/api/auth/x");

    expect(await db.select().from(sentEmails)).toMatchObject([
      { recipient: "ada@example.com", kind: "sign_in" },
    ]);
  });

  it("explains a limit in words the sign-in page can show", async () => {
    await alreadySent(3, "sign_in", 1, "ada@example.com");

    await expect(
      sendSignInEmail("ada@example.com", "https://yousiverse.com/api/auth/x"),
    ).rejects.toMatchObject({
      status: "TOO_MANY_REQUESTS",
      body: { message: expect.stringContaining("wait 15 minutes") },
    });
  });

  it("explains an outage without showing the email service's own error", async () => {
    vi.stubEnv("PROVIDER_FIXTURES", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "API key is invalid" }, { status: 403 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendSignInEmail("ada@example.com", "https://yousiverse.com/api/auth/x"),
    ).rejects.toMatchObject({
      status: "SERVICE_UNAVAILABLE",
      body: { message: "The sign-in email could not be sent. Try again in a little while." },
    });
    vi.restoreAllMocks();
  });
});

import { z } from "zod";

const parsed = z
  .object({
    ADMIN_EMAILS: z.string().default(""),
    // Read by the Inngest SDK itself. Validated here so a blank value is caught at startup.
    INNGEST_SIGNING_KEY: z.string().min(1).optional(),
    INNGEST_EVENT_KEY: z.string().min(1).optional(),
  })
  .parse(process.env);

/** The sign-in emails of the people who review suggested links. Nobody can when it is empty. */
export const adminEmails = new Set(
  parsed.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

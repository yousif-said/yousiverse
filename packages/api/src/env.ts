import { z } from "zod";

const parsed = z.object({ ADMIN_EMAILS: z.string().default("") }).parse(process.env);

/** The sign-in emails of the people who review suggested links. Nobody can when it is empty. */
export const adminEmails = new Set(
  parsed.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

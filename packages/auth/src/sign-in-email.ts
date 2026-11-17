import { db } from "@yousiverse/db";
import { type EmailContent, EmailLimitError, renderEmail, sendEmail } from "@yousiverse/email";
import { ProviderError } from "@yousiverse/integrations/errors";
import { APIError } from "better-auth/api";

/** How long an emailed sign-in link works. Email can be slow, so longer than the default 5. */
export const SIGN_IN_LINK_MINUTES = 10;

export function signInEmail(url: string): EmailContent {
  return renderEmail({
    subject: "Your Yousiverse sign-in link",
    heading: "Sign in to Yousiverse",
    paragraphs: [
      `Use the button below to sign in. The link works once and expires in ${SIGN_IN_LINK_MINUTES} minutes.`,
    ],
    action: { label: "Sign in", url },
    footnotes: [{ text: "If you did not ask for this, you can ignore this email." }],
  });
}

/**
 * Emails a sign-in link. A failure becomes an error the sign-in page can show as it is: what
 * happened and what to do next.
 */
export async function sendSignInEmail(email: string, url: string): Promise<void> {
  try {
    await sendEmail(db, { to: email, kind: "sign_in", content: signInEmail(url) });
  } catch (error) {
    if (error instanceof EmailLimitError) {
      throw new APIError("TOO_MANY_REQUESTS", {
        message:
          error.limit === "address"
            ? "Several sign-in links were just sent to this address. Use the newest one, or wait 15 minutes to ask for another."
            : "No more sign-in emails can be sent today. Sign in another way, or try again tomorrow.",
      });
    }
    if (error instanceof ProviderError) {
      console.error("Could not send a sign-in email.", error);
      throw new APIError("SERVICE_UNAVAILABLE", {
        message: "The sign-in email could not be sent. Try again in a little while.",
      });
    }
    throw error;
  }
}

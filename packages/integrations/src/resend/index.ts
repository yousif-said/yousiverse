import { z } from "zod";
import { env } from "../env";
import { requestJson } from "../http";

const EMAILS_URL = "https://api.resend.com/emails";

const sentResponse = z.object({ id: z.string() });

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  /** The same message for mail programs that do not show HTML. */
  text: string;
};

/** Sends one email from the app's own address (EMAIL_FROM). Returns Resend's id for it. */
export async function sendEmail(email: OutgoingEmail): Promise<string> {
  const { id } = await requestJson("resend", new URL(EMAILS_URL), sentResponse, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, ...email }),
  });
  return id;
}

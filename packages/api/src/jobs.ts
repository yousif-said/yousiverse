import { db } from "@yousiverse/db";
import { Inngest } from "inngest";
import { runAlertCheck } from "./alerts/check";

/**
 * Background jobs run on Inngest, which calls them over HTTP at /api/inngest. In production that
 * address only answers requests signed with INNGEST_SIGNING_KEY. Everywhere else it talks to the
 * Inngest dev server on this machine, which needs no keys.
 */
export const inngest = new Inngest({
  id: "yousiverse",
  isDev: process.env.NODE_ENV !== "production",
});

/** Every morning at 9, US Eastern time. One run at a time, so two cannot email the same news. */
export const checkAlerts = inngest.createFunction(
  {
    id: "check-alerts",
    triggers: [{ cron: "TZ=America/New_York 0 9 * * *" }],
    retries: 2,
    concurrency: 1,
  },
  ({ step }) => runAlertCheck(db, (name, work) => step.run(name, work) as ReturnType<typeof work>),
);

export const functions = [checkAlerts];

import { db } from "@yousiverse/db";
import { Inngest } from "inngest";
import { runAlertCheck } from "./alerts/check";
import { runCalendarRefresh } from "./calendar/refresh";
import type { StepRunner } from "./step-runner";

/**
 * Background jobs run on Inngest, which calls them over HTTP at /api/inngest. In production that
 * address only answers requests signed with INNGEST_SIGNING_KEY. Everywhere else it talks to the
 * Inngest dev server on this machine, which needs no keys.
 */
export const inngest = new Inngest({
  id: "yousiverse",
  isDev: process.env.NODE_ENV !== "production",
});

type InngestStep = { run: (name: string, work: () => Promise<unknown>) => Promise<unknown> };

/**
 * Adapts Inngest's steps to the jobs' own runner. Inngest hands a step's result back as it was
 * stored, in JSON; the jobs only return counts and ids from steps, which survive that unchanged.
 */
const stepsOf =
  (step: InngestStep): StepRunner =>
  (name, work) =>
    step.run(name, work) as ReturnType<typeof work>;

/** Every morning at 9, US Eastern time. One run at a time, so two cannot email the same news. */
export const checkAlerts = inngest.createFunction(
  {
    id: "check-alerts",
    triggers: [{ cron: "TZ=America/New_York 0 9 * * *" }],
    retries: 2,
    concurrency: 1,
  },
  ({ step }) => runAlertCheck(db, stepsOf(step)),
);

/** Every morning at 5, US Eastern time: picks up new release dates and episodes for the calendar. */
export const refreshCalendar = inngest.createFunction(
  {
    id: "refresh-calendar",
    triggers: [{ cron: "TZ=America/New_York 0 5 * * *" }],
    retries: 2,
    concurrency: 1,
  },
  ({ step }) => runCalendarRefresh(db, stepsOf(step)),
);

export const functions = [checkAlerts, refreshCalendar];

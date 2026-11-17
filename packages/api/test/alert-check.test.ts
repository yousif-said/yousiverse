import { db } from "@yousiverse/db";
import { alerts, media, sentEmails, streamingServices, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { runAlertCheck, type StepRunner } from "../src/alerts/check";
import { signedInAs } from "./helpers";

/** Runs each step at once, as the job runner does the first time, and notes the step names. */
function recordingRunner() {
  const names: string[] = [];
  const runStep: StepRunner = (name, work) => {
    names.push(name);
    return work();
  };
  return { names, runStep };
}

async function addMovies(howMany: number, firstId: number) {
  return db
    .insert(media)
    .values(
      Array.from({ length: howMany }, (_, index) => ({
        type: "movie" as const,
        title: `Film ${index}`,
        provider: "tmdb" as const,
        providerId: String(firstId + index),
      })),
    )
    .returning({ id: media.id });
}

describe("runAlertCheck", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
    await db.delete(streamingServices);
    await db.delete(sentEmails);
  });

  it("does nothing much when nobody is waiting on anything", async () => {
    const { names, runStep } = recordingRunner();

    expect(await runAlertCheck(db, runStep)).toEqual({
      titles: 0,
      refreshed: 0,
      triggered: 0,
      emailed: 0,
    });
    expect(names).toEqual(["find-titles", "trigger-alerts", "notify-0"]);
  });

  it("refreshes, triggers, and emails in one run, then has nothing left to do", async () => {
    const ada = await signedInAs("Ada");
    // The Matrix can be streamed in the recorded answers; the alert predates the app knowing.
    const [matrix] = await db
      .insert(media)
      .values({ type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" })
      .returning({ id: media.id });
    await db
      .insert(alerts)
      .values({ userId: ada.user.id, mediaId: matrix?.id ?? "", kind: "streamable" });

    const first = recordingRunner();
    expect(await runAlertCheck(db, first.runStep)).toEqual({
      titles: 1,
      refreshed: 1,
      triggered: 1,
      emailed: 1,
    });
    expect(first.names).toEqual(["find-titles", "refresh-0", "trigger-alerts", "notify-0"]);
    expect(await db.select().from(sentEmails)).toMatchObject([
      { recipient: "ada@example.com", kind: "alerts" },
    ]);

    expect(await runAlertCheck(db, recordingRunner().runStep)).toEqual({
      titles: 0,
      refreshed: 0,
      triggered: 0,
      emailed: 0,
    });
    expect(await db.select().from(sentEmails)).toHaveLength(1);
  });

  it("splits the work into steps with names that never repeat within a run", async () => {
    const people = await Promise.all(
      Array.from({ length: 12 }, (_, index) => signedInAs(`Person${index}`)),
    );
    // Twelve titles nobody can stream (no answer is recorded for them), in three batches.
    const titles = await addMovies(12, 910_000);
    await db.insert(alerts).values(
      titles.map(({ id }, index) => ({
        userId: people[index]?.user.id ?? "",
        mediaId: id,
        kind: "streamable" as const,
        // Already found true, so each of the twelve people is owed an email.
        triggeredAt: new Date(),
        outcome: "now streaming on Tubi",
      })),
    );
    const waiting = await addMovies(12, 920_000);
    await db.insert(alerts).values(
      waiting.map(({ id }) => ({
        userId: people[0]?.user.id ?? "",
        mediaId: id,
        kind: "streamable" as const,
      })),
    );
    const { names, runStep } = recordingRunner();

    const result = await runAlertCheck(db, runStep);

    expect(result).toMatchObject({ titles: 12, refreshed: 0, triggered: 0, emailed: 12 });
    expect(names).toEqual([
      "find-titles",
      "refresh-0",
      "refresh-1",
      "refresh-2",
      "trigger-alerts",
      "notify-0",
      "notify-1",
    ]);
    expect(new Set(names).size).toBe(names.length);
    expect(await db.select().from(sentEmails)).toHaveLength(12);
  });
});

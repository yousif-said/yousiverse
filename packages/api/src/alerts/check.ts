import type { Database } from "@yousiverse/db";
import {
  findTitlesToRefresh,
  notifyNextPeople,
  refreshTitles,
  type TitleToRefresh,
  triggerMetAlerts,
} from "./run";

const TITLES_PER_STEP = 5;
/** A stop for the reporting loop that cannot be reached while each batch makes progress. */
const MAX_NOTIFY_STEPS = 50;

/**
 * Runs one named piece of work and returns its result. The job runner (Inngest) runs each step
 * as its own request, retries it on its own, and remembers its result, so a step's name must be
 * the same every time the job is replayed.
 */
export type StepRunner = <Result>(name: string, work: () => Promise<Result>) => Promise<Result>;

function inBatches<Item>(items: Item[], size: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/**
 * The daily alert check: refreshes availability and prices for the titles people are waiting
 * on, marks the alerts that came true, and emails each person once about theirs. Steps return
 * only counts and catalog ids, never anything about a person, because the job runner stores
 * what steps return.
 */
export async function runAlertCheck(db: Database, runStep: StepRunner) {
  const titles: TitleToRefresh[] = await runStep("find-titles", () => findTitlesToRefresh(db));
  let refreshed = 0;
  for (const [index, batch] of inBatches(titles, TITLES_PER_STEP).entries()) {
    const result = await runStep(`refresh-${index}`, () => refreshTitles(db, batch));
    refreshed += result.refreshed;
  }

  const triggered = await runStep("trigger-alerts", () => triggerMetAlerts(db));

  let emailed = 0;
  for (let index = 0; index < MAX_NOTIFY_STEPS; index += 1) {
    const batch = await runStep(`notify-${index}`, () => notifyNextPeople(db));
    emailed += batch.emailed;
    if (batch.finished) break;
  }
  return { titles: titles.length, refreshed, triggered, emailed };
}

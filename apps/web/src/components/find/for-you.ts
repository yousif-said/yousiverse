import type { RouterOutputs } from "@yousiverse/api";
import { formatRating, formatRuntime, pluralize } from "@/lib/format";

/** The stretches of time "How long have you got?" offers, in the words on its control. */
export const BUDGETS = {
  hour: "An hour",
  two: "Two hours",
  evening: "An evening",
  weekend: "A weekend",
} as const;
export type Budget = keyof typeof BUDGETS;
export const BUDGET_CHOICES = Object.keys(BUDGETS) as Budget[];
export const DEFAULT_BUDGET: Budget = "evening";

export function isBudget(value: unknown): value is Budget {
  return typeof value === "string" && Object.hasOwn(BUDGETS, value);
}

/** The address of For you with these choices made. The usual stretch of time is left out of it. */
export function forYouPath(choices: { budget: Budget; companion?: string }): string {
  const params = new URLSearchParams();
  if (choices.budget !== DEFAULT_BUDGET) params.set("budget", choices.budget);
  if (choices.companion) params.set("with", choices.companion);
  return params.size > 0 ? `/recommendations?${params}` : "/recommendations";
}

type TimePick = RouterOutputs["recommendations"]["forTime"]["picks"][number];
type TogetherPick = RouterOutputs["recommendations"]["forTwo"][number];

/** Why a title fits the time: "1h 46m", "Episode 7, 52m", "5 episodes, about 5h 30m", "444 pages". */
export function fitLabel(fit: TimePick["fit"]): string {
  switch (fit.kind) {
    case "movie":
      return formatRuntime(fit.minutes);
    case "episodes":
      return fit.count === 1
        ? `Episode ${fit.episodeNumber}, ${formatRuntime(fit.minutes)}`
        : `${fit.count} episodes, about ${formatRuntime(fit.minutes)}`;
    case "pages":
      return fit.started ? `${pluralize(fit.pages, "page")} left` : pluralize(fit.pages, "page");
  }
}

/** Why two people would both enjoy a title: "You want it, mara rated it 9". */
export function togetherLabel(
  { reason, rating }: Pick<TogetherPick, "reason" | "rating">,
  username: string,
): string {
  const rated = rating === null ? "" : formatRating(rating);
  switch (reason) {
    case "you_want_they_rated":
      return `You want it, ${username} rated it ${rated}`;
    case "both_want":
      return "You both want it";
    case "you_rated_they_want":
      return `You rated it ${rated}, ${username} wants it`;
    case "they_rated":
      return `${username} rated it ${rated}`;
  }
}

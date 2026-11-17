import type { RouterOutputs } from "@yousiverse/api";
import { formatPrice } from "./format";

export type TitleAlerts = RouterOutputs["alerts"]["forTitle"];
export type Alert = TitleAlerts["alerts"][number];
export type AlertKind = Alert["kind"];

/** What an alert waits for, ready to follow "when": "it costs $9.99 or less". */
export function alertCondition(kind: AlertKind, targetCents: number | null): string {
  switch (kind) {
    case "on_my_subscriptions":
      return "it is on one of your subscriptions";
    case "streamable":
      return "it can be streamed";
    case "price_at_most":
      return targetCents === null
        ? "its price drops"
        : `it costs ${formatPrice(targetCents)} or less`;
  }
}

/**
 * Reads an amount of money a person typed, as cents: "9.99", "$9.99", "10". Null for anything
 * that is not a plain amount above zero.
 */
export function parseDollars(text: string): number | null {
  const match = /^\$?\s*(\d{1,4})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** "The first letter in capitals", for showing an outcome such as "now $9.99 at Steam" alone. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

import type { RouterOutputs } from "@yousiverse/api";
import { formatPrice } from "./format";

export type TitleAlerts = RouterOutputs["alerts"]["forTitle"];
export type Alert = TitleAlerts["alerts"][number];
export type AlertKind = Alert["kind"];
/** One of the signed-in person's alerts as the alerts page lists it, with its title. */
export type MyAlert = RouterOutputs["alerts"]["mine"]["alerts"][number];
/** A game's stored prices: the cheapest store now, the usual price, and the lowest ever. */
export type StoredPrice = NonNullable<MyAlert["price"]>;

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

const MAX_SERVICES_NAMED = 3;

/**
 * What a waiting alert waits for, as the line under its title: "$9.99 or less at a PC store".
 * `subscriptions` names the services the person has, which an alert on them watches.
 */
export function waitingFor(
  kind: AlertKind,
  targetCents: number | null,
  subscriptions: string[],
): string {
  switch (kind) {
    case "price_at_most":
      return targetCents === null
        ? "A lower price at a PC store"
        : `${formatPrice(targetCents)} or less at a PC store`;
    case "streamable":
      return "Streaming anywhere, on a subscription or free";
    case "on_my_subscriptions": {
      if (subscriptions.length === 0) return "On one of your subscriptions";
      const named = subscriptions.slice(0, MAX_SERVICES_NAMED).join(", ");
      const more = subscriptions.length - MAX_SERVICES_NAMED;
      return more > 0 ? `On ${named}, and ${more} more` : `On ${named}`;
    }
  }
}

/** The name of the button that removes an alert, which says which alert when a title has two. */
export function removeAlertLabel(
  title: string,
  kind: AlertKind,
  targetCents: number | null,
): string {
  return `Remove the alert on ${title} for when ${alertCondition(kind, targetCents)}`;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Where each price sits along a price bar, as a percentage from its left end. The bar runs from
 * a little under the lowest price shown up to the usual price, and no mark sits at the very edge.
 */
export function priceBarPositions(price: StoredPrice, targetCents: number) {
  const start = Math.min(price.lowestCents ?? targetCents, targetCents) * 0.9;
  const span = Math.max(1, Math.max(price.regularCents, price.nowCents) - start);
  const at = (cents: number) => clamp(((cents - start) / span) * 100, 4, 96);
  return {
    now: at(price.nowCents),
    target: at(targetCents),
    lowest: price.lowestCents === null ? null : at(price.lowestCents),
  };
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

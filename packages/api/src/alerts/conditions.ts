import type { Database } from "@yousiverse/db";
import {
  alerts,
  gameDeals,
  streamingOffers,
  streamingServices,
  userSubscriptions,
} from "@yousiverse/db/schema";
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

/** An alert whose wait is over, with what was found in words: "now $9.99 at Steam". */
export type MetAlert = { alertId: string; outcome: string };

const MAX_SERVICES_NAMED = 3;

function listed(names: string[]): string {
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  const shown = unique.slice(0, MAX_SERVICES_NAMED);
  const more = unique.length - shown.length;
  return new Intl.ListFormat("en-US", { type: "conjunction" }).format(
    more > 0 ? [...shown, `${more} more`] : shown,
  );
}

export function priceText(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function grouped(rows: { alertId: string; service: string }[]): Map<string, string[]> {
  const services = new Map<string, string[]>();
  for (const row of rows) {
    services.set(row.alertId, [...(services.get(row.alertId) ?? []), row.service]);
  }
  return services;
}

/**
 * Finds the waiting alerts that the stored availability and prices now satisfy. Reads only what
 * is already stored, so it is cheap; refreshing that data is a separate step. `alertId` limits
 * the search to one alert.
 */
export async function findMetAlerts(db: Database, alertId?: string): Promise<MetAlert[]> {
  const waiting = (kind: (typeof alerts.$inferSelect)["kind"]) =>
    and(
      eq(alerts.kind, kind),
      isNull(alerts.triggeredAt),
      alertId ? eq(alerts.id, alertId) : undefined,
    );

  const [onSubscriptions, streamable, cheapEnough] = await Promise.all([
    db
      .select({ alertId: alerts.id, service: streamingServices.name })
      .from(alerts)
      .innerJoin(
        streamingOffers,
        and(eq(streamingOffers.mediaId, alerts.mediaId), eq(streamingOffers.kind, "subscription")),
      )
      .innerJoin(
        userSubscriptions,
        and(
          eq(userSubscriptions.serviceId, streamingOffers.serviceId),
          eq(userSubscriptions.userId, alerts.userId),
        ),
      )
      .innerJoin(streamingServices, eq(streamingServices.id, streamingOffers.serviceId))
      .where(waiting("on_my_subscriptions")),
    db
      .select({ alertId: alerts.id, service: streamingServices.name })
      .from(alerts)
      .innerJoin(
        streamingOffers,
        and(
          eq(streamingOffers.mediaId, alerts.mediaId),
          inArray(streamingOffers.kind, ["subscription", "free"]),
        ),
      )
      .innerJoin(streamingServices, eq(streamingServices.id, streamingOffers.serviceId))
      .where(waiting("streamable")),
    db
      .select({ alertId: alerts.id, shop: gameDeals.shop, priceCents: gameDeals.priceCents })
      .from(alerts)
      .innerJoin(
        gameDeals,
        and(eq(gameDeals.mediaId, alerts.mediaId), lte(gameDeals.priceCents, alerts.targetCents)),
      )
      .where(waiting("price_at_most"))
      .orderBy(asc(gameDeals.priceCents), asc(gameDeals.shop)),
  ]);

  const cheapest = new Map<string, string>();
  for (const deal of cheapEnough) {
    // Cheapest first, so the first deal seen for an alert is the one to report.
    if (!cheapest.has(deal.alertId)) {
      cheapest.set(deal.alertId, `now ${priceText(deal.priceCents)} at ${deal.shop}`);
    }
  }
  return [
    ...[...grouped(onSubscriptions)].map(([id, services]) => ({
      alertId: id,
      outcome: `now on ${listed(services)}, which you subscribe to`,
    })),
    ...[...grouped(streamable)].map(([id, services]) => ({
      alertId: id,
      outcome: `now streaming on ${listed(services)}`,
    })),
    ...[...cheapest].map(([id, outcome]) => ({ alertId: id, outcome })),
  ];
}

import { env } from "../env";
import { requestJson } from "../http";
import { titleSourcesResponse } from "./schemas";

const API_URL = "https://api.watchmode.com/v1";
const REGION = "US";

export const offerKinds = ["subscription", "free", "tv_provider", "rent", "buy"] as const;
export type OfferKind = (typeof offerKinds)[number];

const KIND_FOR: Record<string, OfferKind> = {
  sub: "subscription",
  free: "free",
  tve: "tv_provider",
  rent: "rent",
  buy: "buy",
};

export type StreamingOffer = {
  /** Watchmode's id for the service. */
  serviceId: number;
  serviceName: string;
  kind: OfferKind;
  /** The lowest price across picture qualities. For a TV show, the price of one episode. */
  priceCents: number | null;
  url: string;
};

/**
 * Where a movie or TV show can be watched in the US, one offer per service and kind.
 * Titles are looked up by their TMDB id.
 */
export async function getStreamingOffers(
  type: "movie" | "tv",
  tmdbId: string,
): Promise<StreamingOffer[]> {
  const url = new URL(`${API_URL}/title/${type}-${encodeURIComponent(tmdbId)}/sources/`);
  url.search = new URLSearchParams({ regions: REGION, apiKey: env.WATCHMODE_API_KEY }).toString();
  const sources = await requestJson("watchmode", url, titleSourcesResponse);

  const offers = new Map<string, StreamingOffer>();
  for (const source of sources) {
    const kind = KIND_FOR[source.type];
    if (!kind || !source.web_url || source.region !== REGION) continue;

    const priceCents = source.price === null ? null : Math.round(source.price * 100);
    const key = `${source.source_id}:${kind}`;
    const existing = offers.get(key);
    if (!existing) {
      offers.set(key, {
        serviceId: source.source_id,
        serviceName: source.name,
        kind,
        priceCents,
        url: source.web_url,
      });
    } else if (
      priceCents !== null &&
      (existing.priceCents === null || priceCents < existing.priceCents)
    ) {
      existing.priceCents = priceCents;
    }
  }
  return [...offers.values()];
}

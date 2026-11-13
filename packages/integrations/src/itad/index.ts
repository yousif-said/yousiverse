import { env } from "../env";
import { requestJson } from "../http";
import { lookupResponse, pricesResponse } from "./schemas";

const API_URL = "https://api.isthereanydeal.com";
const COUNTRY = "US";
const CURRENCY = "USD";

export type GameDeal = {
  shop: string;
  priceCents: number;
  /** The price without any discount. Equal to `priceCents` when the game is not on sale. */
  regularPriceCents: number;
  url: string;
};

export type GamePrices = {
  /** The lowest price the game has ever had in any store. */
  lowestEverCents: number | null;
  deals: GameDeal[];
};

function endpoint(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(`${API_URL}${path}`);
  url.search = new URLSearchParams({ ...params, key: env.ITAD_API_KEY }).toString();
  return url;
}

/**
 * Current US prices for a PC game in every store IsThereAnyDeal follows, found by the game's
 * Steam id. Returns null for a game it does not know.
 */
export async function getGamePrices(steamAppId: string): Promise<GamePrices | null> {
  const lookup = await requestJson(
    "itad",
    endpoint("/games/lookup/v1", { appid: steamAppId }),
    lookupResponse,
  );
  if (!lookup.found || !lookup.game) return null;

  const [prices] = await requestJson(
    "itad",
    endpoint("/games/prices/v3", { country: COUNTRY }),
    pricesResponse,
    {
      method: "POST",
      body: JSON.stringify([lookup.game.id]),
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!prices) return { lowestEverCents: null, deals: [] };

  // One price per store: the cheapest, should a store list the game twice.
  const deals = new Map<string, GameDeal>();
  for (const deal of prices.deals) {
    if (deal.price.currency !== CURRENCY || deal.regular.currency !== CURRENCY) continue;
    const existing = deals.get(deal.shop.name);
    if (existing && existing.priceCents <= deal.price.amountInt) continue;
    deals.set(deal.shop.name, {
      shop: deal.shop.name,
      priceCents: deal.price.amountInt,
      regularPriceCents: deal.regular.amountInt,
      url: deal.url,
    });
  }

  const lowest = prices.historyLow?.all;
  return {
    lowestEverCents: lowest?.currency === CURRENCY ? lowest.amountInt : null,
    deals: [...deals.values()],
  };
}

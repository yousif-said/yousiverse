import { describe, expect, it } from "vitest";
import { getGamePrices } from "../src/itad";

describe("itad.getGamePrices", () => {
  it("lists what a game costs in each store, found by its Steam id", async () => {
    const prices = await getGamePrices("1145360");

    expect(prices?.lowestEverCents).toBe(624);
    expect(prices?.deals).toContainEqual({
      shop: "Steam",
      priceCents: 2499,
      regularPriceCents: 2499,
      url: expect.stringMatching(/^https:\/\//),
    });
    const shops = prices?.deals.map((deal) => deal.shop) ?? [];
    expect(new Set(shops).size).toBe(shops.length);
  });

  it("has no prices for a game it does not know", async () => {
    expect(await getGamePrices("999999999")).toBeNull();
  });
});

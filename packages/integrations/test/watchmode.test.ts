import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { getStreamingOffers } from "../src/watchmode";

describe("watchmode.getStreamingOffers", () => {
  it("lists each service once per kind, at its lowest price", async () => {
    const offers = await getStreamingOffers("movie", "603");

    const keys = offers.map((offer) => `${offer.serviceId}:${offer.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(offers).toContainEqual({
      serviceId: 24,
      serviceName: "Amazon",
      kind: "rent",
      priceCents: 499,
      url: expect.stringMatching(/^https:\/\//),
    });
    expect(offers).toContainEqual(
      expect.objectContaining({ serviceName: "Pluto TV", kind: "free", priceCents: null }),
    );
  });

  it("finds a TV show by its TMDB id", async () => {
    expect(await getStreamingOffers("tv", "95396")).toContainEqual(
      expect.objectContaining({ serviceName: "AppleTV+", kind: "subscription", priceCents: null }),
    );
  });

  it("reports a title it does not know as not found", async () => {
    const error = await getStreamingOffers("movie", "999999999").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "watchmode", kind: "not_found" });
  });
});

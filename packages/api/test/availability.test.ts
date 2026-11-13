import { db } from "@yousiverse/db";
import {
  availabilityChecks,
  media,
  streamingOffers,
  streamingServices,
} from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous } from "./helpers";

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("availability.streaming", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(streamingServices);
  });

  it("lists where a movie can be watched, grouped by kind and cheapest first", async () => {
    const mediaId = await addTitle({
      type: "movie",
      title: "The Matrix",
      provider: "tmdb",
      providerId: "603",
    });

    const result = await anonymous.availability.streaming({ mediaId });

    expect(result.outOfDate).toBe(false);
    const kinds = result.offers?.map((offer) => offer.kind) ?? [];
    expect([...new Set(kinds)]).toEqual(["subscription", "free", "rent", "buy"]);
    const rentalPrices = (result.offers ?? [])
      .filter((offer) => offer.kind === "rent")
      .map((offer) => offer.priceCents ?? 0);
    expect(rentalPrices).toEqual([...rentalPrices].sort((a, b) => a - b));
    expect(result.offers).toContainEqual(
      expect.objectContaining({ service: "Amazon", kind: "rent", priceCents: 499 }),
    );
  });

  it("keeps the stored offers for a week instead of asking the provider again", async () => {
    const mediaId = await addTitle({
      type: "movie",
      title: "The Matrix",
      provider: "tmdb",
      providerId: "603",
    });
    await anonymous.availability.streaming({ mediaId });
    await db.delete(streamingOffers);

    expect(await anonymous.availability.streaming({ mediaId })).toMatchObject({ offers: [] });

    await db
      .update(availabilityChecks)
      .set({ checkedAt: new Date(Date.now() - 8 * DAY_MS) })
      .where(eq(availabilityChecks.mediaId, mediaId));
    const refreshed = await anonymous.availability.streaming({ mediaId });
    expect(refreshed.offers?.length).toBeGreaterThan(0);
  });

  it("answers with no offers for a title the provider does not know", async () => {
    const mediaId = await addTitle({
      type: "movie",
      title: "Unknown",
      provider: "tmdb",
      providerId: "999999999",
    });

    expect(await anonymous.availability.streaming({ mediaId })).toMatchObject({ offers: [] });
    expect(await db.select().from(availabilityChecks)).toHaveLength(1);
  });

  it("says the answer is unknown when the provider cannot be reached and nothing is stored", async () => {
    // No response is recorded for this title, so the request fails like an outage would.
    const mediaId = await addTitle({
      type: "movie",
      title: "Offline",
      provider: "tmdb",
      providerId: "424242",
    });

    expect(await anonymous.availability.streaming({ mediaId })).toEqual({ offers: null });
  });

  it("serves the stored offers, marked out of date, when a recheck fails", async () => {
    const mediaId = await addTitle({
      type: "movie",
      title: "Offline",
      provider: "tmdb",
      providerId: "424242",
    });
    const [service] = await db
      .insert(streamingServices)
      .values({ watchmodeId: 203, name: "Netflix" })
      .returning();
    if (!service) throw new Error("The service was not created.");
    await db.insert(streamingOffers).values({
      mediaId,
      serviceId: service.id,
      kind: "subscription",
      url: "https://www.netflix.com/title/1",
    });
    await db
      .insert(availabilityChecks)
      .values({ mediaId, checkedAt: new Date(Date.now() - 8 * DAY_MS) });

    expect(await anonymous.availability.streaming({ mediaId })).toMatchObject({
      outOfDate: true,
      offers: [{ service: "Netflix", kind: "subscription", priceCents: null }],
    });
  });

  it("has nothing for games, books, or titles that do not exist", async () => {
    const gameId = await addTitle({
      type: "game",
      title: "Hades",
      provider: "igdb",
      providerId: "113112",
    });

    await expect(anonymous.availability.streaming({ mediaId: gameId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      anonymous.availability.streaming({ mediaId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

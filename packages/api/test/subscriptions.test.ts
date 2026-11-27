import { db } from "@yousiverse/db";
import { media, streamingServices, users } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as watchmode from "@yousiverse/integrations/watchmode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anonymous, signedInAs } from "./helpers";

const SEVERANCE = {
  type: "tv",
  title: "Severance",
  provider: "tmdb",
  providerId: "95396",
} as const;

async function serviceNamed(
  caller: Awaited<ReturnType<typeof signedInAs>>["caller"],
  name: string,
) {
  const service = (await caller.subscriptions.services())?.find((each) => each.name === name);
  if (!service) throw new Error(`No service named ${name}.`);
  return service;
}

describe("subscriptions", () => {
  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    await db.delete(streamingServices);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires signing in", async () => {
    await expect(anonymous.subscriptions.services()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymous.subscriptions.set({
        serviceId: "00000000-0000-4000-8000-000000000000",
        subscribed: true,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("lists subscription services only, most widely used first, none chosen yet", async () => {
    const { caller } = await signedInAs("Ada");

    const services = (await caller.subscriptions.services()) ?? [];

    expect(services.slice(0, 2).map((service) => service.name)).toEqual(["Netflix", "Hulu"]);
    expect(services.every((service) => !service.subscribed)).toBe(true);
    // Pluto TV is free and Amazon is a store: neither is a subscription.
    expect(services.map((service) => service.name)).not.toContain("Pluto TV");
    expect(services.map((service) => service.name)).not.toContain("Amazon");
  });

  it("gives each service its logo, for drawing its mark", async () => {
    const { caller } = await signedInAs("Ada");

    expect(await serviceNamed(caller, "Netflix")).toEqual({
      id: expect.any(String),
      name: "Netflix",
      logoUrl: "https://cdn.watchmode.com/provider_logos/netflix_100px.png",
      subscribed: false,
    });
  });

  it("keeps the stored list for a month instead of asking the provider again", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.subscriptions.services();
    const getStreamingServices = vi.spyOn(watchmode, "getStreamingServices");

    await caller.subscriptions.services();

    expect(getStreamingServices).not.toHaveBeenCalled();
  });

  it("says the list is unknown when the provider cannot be reached and nothing is stored", async () => {
    const { caller } = await signedInAs("Ada");
    vi.spyOn(watchmode, "getStreamingServices").mockRejectedValue(
      new ProviderError("watchmode", "unavailable", "down"),
    );

    expect(await caller.subscriptions.services()).toBeNull();
  });

  it("adds and removes a subscription, for that person only", async () => {
    const { caller: ada } = await signedInAs("Ada");
    const { caller: grace } = await signedInAs("Grace");
    const netflix = await serviceNamed(ada, "Netflix");

    await ada.subscriptions.set({ serviceId: netflix.id, subscribed: true });
    await ada.subscriptions.set({ serviceId: netflix.id, subscribed: true });

    expect(await serviceNamed(ada, "Netflix")).toMatchObject({ subscribed: true });
    expect(await serviceNamed(grace, "Netflix")).toMatchObject({ subscribed: false });

    await ada.subscriptions.set({ serviceId: netflix.id, subscribed: false });
    expect(await serviceNamed(ada, "Netflix")).toMatchObject({ subscribed: false });
  });

  it("names a person's own subscriptions, most widely used first, from what is stored", async () => {
    const { caller: ada } = await signedInAs("Ada");
    const { caller: grace } = await signedInAs("Grace");
    for (const name of ["AppleTV+", "Netflix"]) {
      const service = await serviceNamed(ada, name);
      await ada.subscriptions.set({ serviceId: service.id, subscribed: true });
    }
    const getStreamingServices = vi.spyOn(watchmode, "getStreamingServices");
    await db.update(streamingServices).set({ listedAt: new Date(0) });

    expect(await ada.subscriptions.mine()).toEqual([
      {
        id: expect.any(String),
        name: "Netflix",
        logoUrl: "https://cdn.watchmode.com/provider_logos/netflix_100px.png",
      },
      { id: expect.any(String), name: "AppleTV+", logoUrl: expect.any(String) },
    ]);
    expect(await grace.subscriptions.mine()).toEqual([]);
    // Even a list due a refresh is read as it is: this never reaches the provider.
    expect(getStreamingServices).not.toHaveBeenCalled();
    await expect(anonymous.subscriptions.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses a service that is not a subscription or does not exist", async () => {
    const { caller } = await signedInAs("Ada");
    await caller.subscriptions.services();
    const [store] = await db
      .insert(streamingServices)
      .values({ watchmodeId: 999_999, name: "A store" })
      .returning();
    if (!store) throw new Error("The service was not created.");

    await expect(
      caller.subscriptions.set({ serviceId: store.id, subscribed: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.subscriptions.set({
        serviceId: "00000000-0000-4000-8000-000000000000",
        subscribed: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("marks the offers included in the viewer's own subscriptions, and no one else's", async () => {
    const [show] = await db.insert(media).values(SEVERANCE).returning({ id: media.id });
    if (!show) throw new Error("The show was not created.");
    const { caller: ada } = await signedInAs("Ada");
    const { caller: grace } = await signedInAs("Grace");
    const appleTv = await serviceNamed(ada, "AppleTV+");
    await ada.subscriptions.set({ serviceId: appleTv.id, subscribed: true });

    const included = async (caller: typeof ada | typeof anonymous) => {
      const { offers } = await caller.availability.streaming({ mediaId: show.id });
      return offers?.filter((offer) => offer.included).map((offer) => offer.service);
    };

    expect(await included(ada)).toEqual(["AppleTV+"]);
    expect(await included(grace)).toEqual([]);
    expect(await included(anonymous)).toEqual([]);
    expect(await ada.availability.streaming({ mediaId: show.id })).toMatchObject({
      subscriptionCount: 1,
    });
    expect(await grace.availability.streaming({ mediaId: show.id })).toMatchObject({
      subscriptionCount: 0,
    });
    expect(await anonymous.availability.streaming({ mediaId: show.id })).toMatchObject({
      subscriptionCount: null,
    });
  });
});

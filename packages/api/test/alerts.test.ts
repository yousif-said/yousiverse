import { db } from "@yousiverse/db";
import {
  alerts,
  availabilityChecks,
  emailPreferences,
  gameDeals,
  games,
  media,
  sentEmails,
  streamingOffers,
  streamingServices,
  users,
} from "@yousiverse/db/schema";
import { ALERTS_DAILY_LIMIT } from "@yousiverse/email";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alertsEmail } from "../src/alerts/email";
import {
  findTitlesToRefresh,
  notifyNextPeople,
  refreshTitles,
  STREAMING_REFRESHES_PER_RUN,
  triggerMetAlerts,
} from "../src/alerts/run";
import { anonymous, signedInAs } from "./helpers";

type Person = Awaited<ReturnType<typeof signedInAs>>;

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

// The Matrix is on YouTube TV (a subscription) and Pluto TV (free) in the recorded answers.
const MATRIX = { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" } as const;
// A movie the availability provider does not know: nowhere to watch it.
const OBSCURE = {
  type: "movie",
  title: "Obscure",
  provider: "tmdb",
  providerId: "999999999",
} as const;
const PIRANESI = {
  type: "book",
  title: "Piranesi",
  provider: "open_library",
  providerId: "OL20893680W",
} as const;

/** Hades, which costs $24.99 in every store in the recorded answers. */
async function addHades() {
  const id = await addTitle({
    type: "game",
    title: "Hades",
    provider: "igdb",
    providerId: "113112",
  });
  await db.insert(games).values({ mediaId: id, steamAppId: "1145360" });
  return id;
}

/** Stores a service and an offer of a title on it, as a refresh would. */
async function offerOn(
  mediaId: string,
  name: string,
  kind: "subscription" | "free" | "rent" = "subscription",
) {
  const [service] = await db
    .insert(streamingServices)
    .values({ watchmodeId: Math.floor(Math.random() * 1e9), name, subscription: true, rank: 1 })
    .returning({ id: streamingServices.id });
  if (!service) throw new Error("The service was not created.");
  await db
    .insert(streamingOffers)
    .values({ mediaId, serviceId: service.id, kind, url: "https://example.com/watch" });
  return service.id;
}

const waitingAlert = (
  person: Person,
  mediaId: string,
  kind: "streamable" | "on_my_subscriptions",
) => db.insert(alerts).values({ userId: person.user.id, mediaId, kind });

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

describe("alerts", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
    await db.delete(streamingServices);
    await db.delete(sentEmails);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("setting an alert", () => {
    it("requires signing in", async () => {
      const mediaId = await addTitle(OBSCURE);

      await expect(anonymous.alerts.set({ mediaId, kind: "streamable" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(anonymous.alerts.forTitle({ mediaId })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("offers streaming alerts for movies and shows, a price alert for games, none for books", async () => {
      const { caller } = await signedInAs("Ada");

      expect((await caller.alerts.forTitle({ mediaId: await addTitle(OBSCURE) })).kinds).toEqual([
        "on_my_subscriptions",
        "streamable",
      ]);
      expect((await caller.alerts.forTitle({ mediaId: await addHades() })).kinds).toEqual([
        "price_at_most",
      ]);
      expect((await caller.alerts.forTitle({ mediaId: await addTitle(PIRANESI) })).kinds).toEqual(
        [],
      );
    });

    it("refuses an alert that does not fit the title, or a price in the wrong place", async () => {
      const { caller } = await signedInAs("Ada");
      const movieId = await addTitle(OBSCURE);
      const gameId = await addHades();
      const bookId = await addTitle(PIRANESI);

      for (const attempt of [
        () => caller.alerts.set({ mediaId: movieId, kind: "price_at_most", targetCents: 500 }),
        () => caller.alerts.set({ mediaId: gameId, kind: "streamable" }),
        () => caller.alerts.set({ mediaId: bookId, kind: "streamable" }),
        () => caller.alerts.set({ mediaId: gameId, kind: "price_at_most" }),
        () => caller.alerts.set({ mediaId: movieId, kind: "streamable", targetCents: 500 }),
        () => caller.alerts.set({ mediaId: gameId, kind: "price_at_most", targetCents: 0 }),
      ]) {
        await expect(attempt()).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      expect(await db.select().from(alerts)).toHaveLength(0);
    });

    it("waits for a movie nobody streams to become streamable", async () => {
      const { caller } = await signedInAs("Ada");
      const mediaId = await addTitle(OBSCURE);

      await caller.alerts.set({ mediaId, kind: "streamable" });

      expect((await caller.alerts.forTitle({ mediaId })).alerts).toEqual([
        {
          id: expect.any(String),
          kind: "streamable",
          targetCents: null,
          triggeredAt: null,
          outcome: null,
        },
      ]);
      expect(await db.select().from(emailPreferences)).toMatchObject([{ alertEmails: true }]);
    });

    it("says no alert is needed when a title can already be streamed", async () => {
      const { caller } = await signedInAs("Ada");
      const mediaId = await addTitle(MATRIX);

      await expect(caller.alerts.set({ mediaId, kind: "streamable" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "No alert needed: it is now streaming on Pluto TV and YouTube TV.",
      });
      expect(await db.select().from(alerts)).toHaveLength(0);
    });

    it("needs subscriptions to be ticked before watching for them", async () => {
      const { caller } = await signedInAs("Ada");
      const mediaId = await addTitle(MATRIX);

      await expect(
        caller.alerts.set({ mediaId, kind: "on_my_subscriptions" }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

      // With a subscription the title is not on, there is something to wait for.
      const services = await caller.subscriptions.services();
      const netflix = services?.find((service) => service.name === "Netflix");
      await caller.subscriptions.set({ serviceId: netflix?.id ?? "", subscribed: true });
      await caller.alerts.set({ mediaId, kind: "on_my_subscriptions" });

      expect(await db.select().from(alerts)).toMatchObject([{ kind: "on_my_subscriptions" }]);
    });

    it("sets a price alert below today's price, and refuses one the price already meets", async () => {
      const { caller } = await signedInAs("Ada");
      const mediaId = await addHades();

      await expect(
        caller.alerts.set({ mediaId, kind: "price_at_most", targetCents: 2499 }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "No alert needed: it is now $24.99 at Epic Game Store.",
      });
      await caller.alerts.set({ mediaId, kind: "price_at_most", targetCents: 1000 });

      expect((await caller.alerts.forTitle({ mediaId })).alerts).toMatchObject([
        { kind: "price_at_most", targetCents: 1000, triggeredAt: null },
      ]);
    });

    it("replaces an alert of the same kind, starting its wait again", async () => {
      const { caller, user } = await signedInAs("Ada");
      const mediaId = await addHades();
      await caller.alerts.set({ mediaId, kind: "price_at_most", targetCents: 1000 });
      await db
        .update(alerts)
        .set({ triggeredAt: new Date(), outcome: "now $9.99 at Steam", notifiedAt: new Date() })
        .where(eq(alerts.userId, user.id));

      await caller.alerts.set({ mediaId, kind: "price_at_most", targetCents: 500 });

      expect(await db.select().from(alerts)).toMatchObject([
        { targetCents: 500, triggeredAt: null, outcome: null, notifiedAt: null },
      ]);
    });

    it("stops one person holding more than 100 alerts", async () => {
      const ada = await signedInAs("Ada");
      const titles = await db
        .insert(media)
        .values(
          Array.from({ length: 100 }, (_, index) => ({
            type: "movie" as const,
            title: `Film ${index}`,
            provider: "tmdb" as const,
            providerId: String(700_000 + index),
          })),
        )
        .returning({ id: media.id });
      await db.insert(alerts).values(
        titles.map(({ id }) => ({
          userId: ada.user.id,
          mediaId: id,
          kind: "streamable" as const,
        })),
      );

      await expect(
        ada.caller.alerts.set({ mediaId: await addTitle(OBSCURE), kind: "streamable" }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    });
  });

  describe("a person's own alerts", () => {
    it("lists them with their titles, and only to their owner", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const mediaId = await addTitle(OBSCURE);
      await ada.caller.alerts.set({ mediaId, kind: "streamable" });

      expect(await ada.caller.alerts.mine()).toEqual({
        emails: true,
        alerts: [
          {
            id: expect.any(String),
            kind: "streamable",
            targetCents: null,
            triggeredAt: null,
            outcome: null,
            title: { type: "movie", providerId: "999999999", title: "Obscure", releaseYear: null },
          },
        ],
      });
      expect(await grace.caller.alerts.mine()).toEqual({ emails: true, alerts: [] });
      expect((await grace.caller.alerts.forTitle({ mediaId })).alerts).toEqual([]);
    });

    it("removes an alert, but never someone else's", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const mediaId = await addTitle(OBSCURE);
      const { id } = await ada.caller.alerts.set({ mediaId, kind: "streamable" });

      await expect(grace.caller.alerts.remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await ada.caller.alerts.remove({ id });

      expect(await db.select().from(alerts)).toHaveLength(0);
      await expect(ada.caller.alerts.remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("turns alert emails off and on, and off again from an unsubscribe link", async () => {
      const { caller } = await signedInAs("Ada");

      await caller.alerts.setEmails({ enabled: false });
      expect((await caller.alerts.mine()).emails).toBe(false);
      await caller.alerts.setEmails({ enabled: true });
      expect((await caller.alerts.mine()).emails).toBe(true);

      const [preferences] = await db.select().from(emailPreferences);
      await anonymous.alerts.unsubscribe({ token: preferences?.unsubscribeToken ?? "" });
      expect((await caller.alerts.mine()).emails).toBe(false);
    });

    it("answers an unknown unsubscribe link the same way, changing nothing", async () => {
      const { caller } = await signedInAs("Ada");
      await caller.alerts.setEmails({ enabled: true });

      await anonymous.alerts.unsubscribe({ token: "not-a-real-token" });

      expect((await caller.alerts.mine()).emails).toBe(true);
    });
  });

  describe("the daily check", () => {
    it("refreshes only titles someone is still waiting on, the longest unchecked first", async () => {
      const ada = await signedInAs("Ada");
      const [never, old, fresh, settled, unwatched] = await Promise.all(
        ["900001", "900002", "900003", "900004", "900005"].map((providerId) =>
          addTitle({ type: "movie", title: providerId, provider: "tmdb", providerId }),
        ),
      );
      const gameId = await addHades();
      for (const mediaId of [never, old, fresh, settled]) {
        await waitingAlert(ada, mediaId ?? "", "streamable");
      }
      await db.insert(alerts).values({
        userId: ada.user.id,
        mediaId: gameId,
        kind: "price_at_most",
        targetCents: 500,
      });
      await db
        .update(alerts)
        .set({ triggeredAt: new Date() })
        .where(eq(alerts.mediaId, settled ?? ""));
      await db.insert(availabilityChecks).values([
        { mediaId: old ?? "", checkedAt: hoursAgo(30) },
        { mediaId: fresh ?? "", checkedAt: hoursAgo(2) },
        { mediaId: unwatched ?? "", checkedAt: hoursAgo(300) },
      ]);

      expect(await findTitlesToRefresh(db)).toEqual([
        { id: never, type: "movie", providerId: "900001" },
        { id: old, type: "movie", providerId: "900002" },
        { id: gameId, type: "game", steamAppId: "1145360" },
      ]);
    });

    it("keeps to the day's budget of availability requests", async () => {
      const ada = await signedInAs("Ada");
      const titles = await db
        .insert(media)
        .values(
          Array.from({ length: STREAMING_REFRESHES_PER_RUN + 5 }, (_, index) => ({
            type: "tv" as const,
            title: `Show ${index}`,
            provider: "tmdb" as const,
            providerId: String(800_000 + index),
          })),
        )
        .returning({ id: media.id });
      await db.insert(alerts).values(
        titles.map(({ id }) => ({
          userId: ada.user.id,
          mediaId: id,
          kind: "streamable" as const,
        })),
      );

      expect(await findTitlesToRefresh(db)).toHaveLength(STREAMING_REFRESHES_PER_RUN);
    });

    it("fetches fresh data, and leaves a title due when its provider fails", async () => {
      const ada = await signedInAs("Ada");
      const matrixId = await addTitle(MATRIX);
      const offlineId = await addTitle({
        type: "movie",
        title: "Offline",
        provider: "tmdb",
        providerId: "424242",
      });
      await waitingAlert(ada, matrixId, "streamable");
      await waitingAlert(ada, offlineId, "streamable");

      expect(await refreshTitles(db, await findTitlesToRefresh(db))).toEqual({
        refreshed: 1,
        failed: 1,
      });
      expect(await findTitlesToRefresh(db)).toMatchObject([{ id: offlineId }]);
    });

    it("triggers a streaming alert once the title is on a subscription or free service", async () => {
      const ada = await signedInAs("Ada");
      const mediaId = await addTitle(OBSCURE);
      await waitingAlert(ada, mediaId, "streamable");
      await offerOn(mediaId, "Amazon", "rent");

      expect(await triggerMetAlerts(db)).toBe(0);

      await offerOn(mediaId, "Netflix");
      await offerOn(mediaId, "Tubi", "free");
      expect(await triggerMetAlerts(db)).toBe(1);
      expect(await db.select().from(alerts)).toMatchObject([
        {
          outcome: "now streaming on Netflix and Tubi",
          triggeredAt: expect.any(Date),
          notifiedAt: null,
        },
      ]);
      // It fires once.
      expect(await triggerMetAlerts(db)).toBe(0);
    });

    it("triggers a subscriptions alert only for the person who has the service", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      const mediaId = await addTitle(OBSCURE);
      await waitingAlert(ada, mediaId, "on_my_subscriptions");
      await waitingAlert(grace, mediaId, "on_my_subscriptions");
      const serviceId = await offerOn(mediaId, "Netflix");
      await ada.caller.subscriptions.set({ serviceId, subscribed: true });

      expect(await triggerMetAlerts(db)).toBe(1);

      expect((await ada.caller.alerts.mine()).alerts).toMatchObject([
        { outcome: "now on Netflix, which you subscribe to" },
      ]);
      expect((await grace.caller.alerts.mine()).alerts).toMatchObject([{ triggeredAt: null }]);
    });

    it("triggers a price alert at the target, reporting the cheapest store", async () => {
      const { caller, user } = await signedInAs("Ada");
      const mediaId = await addHades();
      await caller.alerts.set({ mediaId, kind: "price_at_most", targetCents: 1000 });
      expect(await triggerMetAlerts(db)).toBe(0);

      await db.update(gameDeals).set({ priceCents: 1000 }).where(eq(gameDeals.shop, "Steam"));
      await db
        .update(gameDeals)
        .set({ priceCents: 899 })
        .where(eq(gameDeals.shop, "Microsoft Store"));

      expect(await triggerMetAlerts(db)).toBe(1);
      expect(await db.select().from(alerts).where(eq(alerts.userId, user.id))).toMatchObject([
        { outcome: "now $8.99 at Microsoft Store" },
      ]);
    });

    it("runs end to end: refresh, trigger, and one email per person", async () => {
      const ada = await signedInAs("Ada");
      const matrixId = await addTitle(MATRIX);
      const obscureId = await addTitle(OBSCURE);
      // Set before the movie could be streamed, as far as the app knew.
      await waitingAlert(ada, matrixId, "streamable");
      await waitingAlert(ada, obscureId, "streamable");

      await refreshTitles(db, await findTitlesToRefresh(db));
      expect(await triggerMetAlerts(db)).toBe(1);
      expect(await notifyNextPeople(db)).toEqual({ emailed: 1, muted: 0, finished: true });

      expect(await db.select().from(sentEmails)).toMatchObject([
        { recipient: "ada@example.com", kind: "alerts" },
      ]);
      const [came, waits] = (await ada.caller.alerts.mine()).alerts;
      expect(came).toMatchObject({
        title: { title: "The Matrix" },
        outcome: "now streaming on Pluto TV and YouTube TV",
      });
      expect(waits).toMatchObject({ title: { title: "Obscure" }, triggeredAt: null });
      // The next run has nothing to report.
      expect(await notifyNextPeople(db)).toEqual({ emailed: 0, muted: 0, finished: true });
      expect(await db.select().from(sentEmails)).toHaveLength(1);
    });
  });

  describe("reporting", () => {
    async function triggered(person: Person, title: typeof media.$inferInsert, outcome: string) {
      const mediaId = await addTitle(title);
      await db.insert(alerts).values({
        userId: person.user.id,
        mediaId,
        kind: "streamable",
        triggeredAt: new Date(),
        outcome,
      });
    }

    it("sends one email covering all of a person's alerts, with a way to stop them", async () => {
      const ada = await signedInAs("Ada");
      await triggered(ada, MATRIX, "now streaming on Pluto TV");
      await triggered(ada, OBSCURE, "now streaming on Tubi");
      const sent: Record<string, string>[] = [];
      vi.stubEnv("PROVIDER_FIXTURES", "false");
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: URL, init?: RequestInit) => {
          sent.push(JSON.parse(String(init?.body)));
          return Response.json({ id: "abc" });
        }),
      );

      expect(await notifyNextPeople(db)).toMatchObject({ emailed: 1 });

      expect(sent).toHaveLength(1);
      const [preferences] = await db.select().from(emailPreferences);
      expect(sent[0]).toMatchObject({
        to: "ada@example.com",
        subject: "2 of your Yousiverse alerts came through",
      });
      expect(sent[0]?.text).toContain("- Obscure is now streaming on Tubi:");
      expect(sent[0]?.text).toContain("- The Matrix is now streaming on Pluto TV:");
      expect(sent[0]?.text).toContain(`/alerts/unsubscribe?token=${preferences?.unsubscribeToken}`);
      expect((await db.select().from(alerts)).every((alert) => alert.notifiedAt)).toBe(true);
    });

    it("emails nobody who turned alert emails off, and still settles their alerts", async () => {
      const ada = await signedInAs("Ada");
      await ada.caller.alerts.setEmails({ enabled: false });
      await triggered(ada, MATRIX, "now streaming on Pluto TV");

      expect(await notifyNextPeople(db)).toEqual({ emailed: 0, muted: 1, finished: true });

      expect(await db.select().from(sentEmails)).toHaveLength(0);
      expect(await db.select().from(alerts)).toMatchObject([{ notifiedAt: expect.any(Date) }]);
      expect((await ada.caller.alerts.mine()).alerts).toMatchObject([
        { outcome: "now streaming on Pluto TV" },
      ]);
    });

    it("holds reports over to the next run once the day's alert emails are used up", async () => {
      const ada = await signedInAs("Ada");
      const grace = await signedInAs("Grace");
      await grace.caller.alerts.setEmails({ enabled: false });
      await triggered(ada, MATRIX, "now streaming on Pluto TV");
      await triggered(grace, OBSCURE, "now streaming on Tubi");
      await db.insert(sentEmails).values(
        Array.from({ length: ALERTS_DAILY_LIMIT }, (_, index) => ({
          recipient: `person${index}@example.com`,
          kind: "alerts" as const,
        })),
      );

      expect(await notifyNextPeople(db)).toMatchObject({ emailed: 0, muted: 1, finished: false });
      expect(await notifyNextPeople(db)).toMatchObject({ emailed: 0, muted: 0, finished: true });

      const stillToReport = await db.select().from(alerts).where(eq(alerts.userId, ada.user.id));
      expect(stillToReport).toMatchObject([{ notifiedAt: null }]);
      expect(await db.select().from(sentEmails)).toHaveLength(ALERTS_DAILY_LIMIT);
    });

    it("leaves alerts unreported when the email service fails, so the step can be retried", async () => {
      const ada = await signedInAs("Ada");
      await triggered(ada, MATRIX, "now streaming on Pluto TV");
      vi.stubEnv("PROVIDER_FIXTURES", "false");
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({}, { status: 500 })),
      );

      await expect(notifyNextPeople(db)).rejects.toMatchObject({ provider: "resend" });

      expect(await db.select().from(alerts)).toMatchObject([{ notifiedAt: null }]);
    });
  });
});

describe("alertsEmail", () => {
  const links = { origin: "https://yousiverse.com", unsubscribeToken: "tok en" };
  const matrix = {
    title: "The Matrix",
    type: "movie",
    providerId: "603",
    outcome: "now on Netflix, which you subscribe to",
  } as const;

  it("puts a single alert in the subject and links to the title and the alerts page", () => {
    const { subject, html, text } = alertsEmail([matrix], links);

    expect(subject).toBe("The Matrix is now on Netflix, which you subscribe to");
    expect(html).toContain('href="https://yousiverse.com/movies/603"');
    expect(text).toContain("See your alerts: https://yousiverse.com/alerts");
    expect(text).toContain("https://yousiverse.com/alerts/unsubscribe?token=tok%20en");
  });

  it("counts several alerts in the subject and lists each", () => {
    const hades = {
      title: "Hades",
      type: "game",
      providerId: "113112",
      outcome: "now $9.99 at Steam",
    } as const;
    const { subject, text } = alertsEmail([matrix, hades], links);

    expect(subject).toBe("2 of your Yousiverse alerts came through");
    expect(text).toContain("- Hades is now $9.99 at Steam: https://yousiverse.com/games/113112");
  });
});

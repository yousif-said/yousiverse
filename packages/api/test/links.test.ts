import { db } from "@yousiverse/db";
import { linkChecks, linkSuggestions, media, mediaLinks, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { parseTitleAddress } from "../src/links/address";
import { anonymous, signedInAs } from "./helpers";

async function addTitle(values: typeof media.$inferInsert) {
  const [title] = await db.insert(media).values(values).returning({ id: media.id });
  if (!title) throw new Error("The title was not created.");
  return title.id;
}

const MATRIX = { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" } as const;
const HADES = { type: "game", title: "Hades", provider: "igdb", providerId: "113112" } as const;

const reviewer = () => signedInAs("Reviewer");

async function pendingFor(mediaId: string) {
  return db
    .select()
    .from(linkSuggestions)
    .where(eq(linkSuggestions.mediaId, mediaId))
    .orderBy(linkSuggestions.targetTitle);
}

describe("links", () => {
  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  describe("who may review", () => {
    it("lets only the people named in ADMIN_EMAILS review, whatever the capitals", async () => {
      const first = await reviewer();
      const second = await signedInAs("Second.Reviewer");
      const visitor = await signedInAs("Visitor");

      expect(await first.caller.links.canReview()).toBe(true);
      expect(await second.caller.links.canReview()).toBe(true);
      expect(await visitor.caller.links.canReview()).toBe(false);
      expect(await anonymous.links.canReview()).toBe(false);
    });

    it("does not trust an email address that was never confirmed", async () => {
      const unconfirmed = await signedInAs("Reviewer", { emailVerified: false });

      expect(await unconfirmed.caller.links.canReview()).toBe(false);
      await expect(unconfirmed.caller.links.suggestions()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("refuses every reviewing action to everyone else", async () => {
      const { caller } = await signedInAs("Visitor");
      const id = crypto.randomUUID();
      const link = { from: "/movies/603", to: "/movies/604", kind: "sequel_of" } as const;

      for (const attempt of [
        () => caller.links.suggestions(),
        () => caller.links.check(),
        () => caller.links.approve({ id }),
        () => caller.links.reject({ id }),
        () => caller.links.add(link),
        () => caller.links.verified(),
        () => caller.links.remove({ id }),
      ]) {
        await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(anonymous.links.check()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(anonymous.links.add(link)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("suggestions", () => {
    it("stores what Wikidata suggests for a title, with games found by their slug", async () => {
      const { caller } = await reviewer();
      const matrixId = await addTitle(MATRIX);

      const result = await caller.links.check();

      expect(result).toMatchObject({ checked: 1, unreadable: 0, remaining: 0 });
      const stored = await pendingFor(matrixId);
      expect(result.suggested).toBe(stored.length);
      expect(stored).toContainEqual(
        expect.objectContaining({
          targetType: "movie",
          targetProviderId: "604",
          targetTitle: "The Matrix Reloaded",
          kind: "sequel_of",
          reversed: true,
          state: "pending",
        }),
      );
      expect(stored).toContainEqual(
        expect.objectContaining({
          targetType: "game",
          targetProviderId: "1003",
          targetTitle: "Enter the Matrix",
          kind: "same_franchise",
          reversed: false,
        }),
      );
    });

    it("shows nothing on the title's page until a suggestion is approved", async () => {
      const { caller } = await reviewer();
      const matrixId = await addTitle(MATRIX);
      await caller.links.check();

      expect(await anonymous.links.forTitle({ mediaId: matrixId })).toEqual([]);
      expect(await db.select().from(mediaLinks)).toHaveLength(0);
    });

    it("looks a title up once, then again after a month", async () => {
      const { caller } = await reviewer();
      const matrixId = await addTitle(MATRIX);
      await caller.links.check();
      await db.delete(linkSuggestions);

      expect(await caller.links.check()).toMatchObject({ checked: 0, suggested: 0 });

      await db
        .update(linkChecks)
        .set({ checkedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
        .where(eq(linkChecks.mediaId, matrixId));
      expect((await caller.links.check()).suggested).toBeGreaterThan(0);
    });

    it("does not suggest a pair again from the other title's side", async () => {
      const { caller } = await reviewer();
      const hadesId = await addTitle(HADES);
      await caller.links.check();
      expect(await pendingFor(hadesId)).toMatchObject([{ targetProviderId: "228525" }]);

      // Hades II, were it looked up, would point back at Hades.
      const sequelId = await addTitle({
        type: "game",
        title: "Hades II",
        provider: "igdb",
        providerId: "228525",
      });
      await db.insert(linkSuggestions).values({
        mediaId: sequelId,
        targetType: "game",
        targetProviderId: "113112",
        targetTitle: "Hades",
        kind: "same_franchise",
      });
      await db.delete(linkSuggestions).where(eq(linkSuggestions.mediaId, hadesId));
      await db.delete(linkChecks);
      await db.insert(linkChecks).values({ mediaId: sequelId, checkedAt: new Date() });

      expect(await caller.links.check()).toMatchObject({ checked: 1, suggested: 0 });
      expect(await pendingFor(hadesId)).toEqual([]);
    });

    it("can pass over a title that is due, leaving it for later", async () => {
      const { caller } = await reviewer();
      const hadesId = await addTitle({ ...HADES, createdAt: new Date("2026-01-01") });
      const matrixId = await addTitle({ ...MATRIX, createdAt: new Date("2026-01-02") });

      // The newest title is first in line; skipping it looks Hades up instead.
      expect(await caller.links.check({ skip: 1 })).toMatchObject({ checked: 1, remaining: 1 });

      expect(await pendingFor(hadesId)).toHaveLength(1);
      expect(await pendingFor(matrixId)).toHaveLength(0);
      expect(await caller.links.check({ skip: 1 })).toMatchObject({ checked: 0, remaining: 1 });
    });

    it("lists pending suggestions with both titles and counts what is left", async () => {
      const { caller } = await reviewer();
      await addTitle(HADES);
      await addTitle({
        type: "movie",
        title: "Unknown",
        provider: "tmdb",
        providerId: "999999999",
      });
      expect((await caller.links.suggestions()).uncheckedTitles).toBe(2);

      expect(await caller.links.check()).toMatchObject({ checked: 1, remaining: 1 });
      expect(await caller.links.check()).toMatchObject({ checked: 1, remaining: 0 });
      expect(await caller.links.check()).toMatchObject({ checked: 0, remaining: 0 });

      const { pending, pendingCount, uncheckedTitles } = await caller.links.suggestions();

      expect(pendingCount).toBe(1);
      expect(uncheckedTitles).toBe(0);
      expect(pending).toEqual([
        {
          id: expect.any(String),
          kind: "same_franchise",
          reversed: false,
          title: { type: "game", providerId: "113112", title: "Hades", releaseYear: null },
          target: { type: "game", providerId: "228525", title: "Hades II" },
        },
      ]);
    });
  });

  describe("approving and rejecting", () => {
    async function suggestSequel() {
      const matrixId = await addTitle(MATRIX);
      const [suggestion] = await db
        .insert(linkSuggestions)
        .values({
          mediaId: matrixId,
          targetType: "movie",
          targetProviderId: "604",
          targetTitle: "The Matrix Reloaded",
          kind: "sequel_of",
          reversed: true,
        })
        .returning({ id: linkSuggestions.id });
      if (!suggestion) throw new Error("The suggestion was not created.");
      return { matrixId, suggestionId: suggestion.id };
    }

    it("adds the other title to the catalog and shows the link from both titles", async () => {
      const { caller, user } = await reviewer();
      const { matrixId, suggestionId } = await suggestSequel();

      await caller.links.approve({ id: suggestionId });

      const [reloaded] = await db.select().from(media).where(eq(media.providerId, "604"));
      expect(reloaded).toMatchObject({ title: "The Matrix Reloaded", releaseYear: 2003 });
      expect(await anonymous.links.forTitle({ mediaId: matrixId })).toEqual([
        {
          id: expect.any(String),
          relation: "followed_by",
          title: {
            type: "movie",
            providerId: "604",
            title: "The Matrix Reloaded",
            releaseYear: 2003,
            posterUrl: expect.stringContaining("https://"),
          },
        },
      ]);
      expect(await anonymous.links.forTitle({ mediaId: reloaded?.id ?? "" })).toMatchObject([
        { relation: "sequel_to", title: { providerId: "603" } },
      ]);
      expect(await db.select().from(mediaLinks)).toMatchObject([
        { fromMediaId: reloaded?.id, toMediaId: matrixId, source: "wikidata", verifiedBy: user.id },
      ]);
      expect((await caller.links.suggestions()).pending).toEqual([]);
    });

    it("keeps a rejected suggestion hidden and does not raise it again", async () => {
      const { caller } = await reviewer();
      const { matrixId, suggestionId } = await suggestSequel();

      await caller.links.reject({ id: suggestionId });

      expect(await anonymous.links.forTitle({ mediaId: matrixId })).toEqual([]);
      await caller.links.check();
      const sequel = (await pendingFor(matrixId)).filter((row) => row.targetProviderId === "604");
      expect(sequel).toMatchObject([{ state: "rejected" }]);
    });

    it("decides a suggestion only once", async () => {
      const { caller } = await reviewer();
      const { suggestionId } = await suggestSequel();
      await caller.links.reject({ id: suggestionId });

      await expect(caller.links.approve({ id: suggestionId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(caller.links.reject({ id: suggestionId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await db.select().from(mediaLinks)).toHaveLength(0);
    });

    it("settles a suggestion whose titles were already linked by hand", async () => {
      const { caller } = await reviewer();
      const { suggestionId } = await suggestSequel();
      await caller.links.add({ from: "/movies/604", to: "/movies/603", kind: "same_franchise" });

      await caller.links.approve({ id: suggestionId });

      expect(await db.select().from(mediaLinks)).toMatchObject([{ kind: "same_franchise" }]);
      expect((await caller.links.suggestions()).pendingCount).toBe(0);
    });

    it("leaves a suggestion pending when the other title cannot be found", async () => {
      const { caller } = await reviewer();
      const matrixId = await addTitle(MATRIX);
      const [suggestion] = await db
        .insert(linkSuggestions)
        .values({
          mediaId: matrixId,
          targetType: "movie",
          targetProviderId: "999999999",
          targetTitle: "A Film Nobody Has",
          kind: "same_franchise",
        })
        .returning({ id: linkSuggestions.id });

      await expect(caller.links.approve({ id: suggestion?.id ?? "" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect((await caller.links.suggestions()).pendingCount).toBe(1);
    });
  });

  describe("linking by hand", () => {
    it("links two titles named by their page addresses", async () => {
      const { caller } = await reviewer();

      await caller.links.add({
        from: "https://yousiverse.com/movies/604",
        to: "/movies/603",
        kind: "sequel_of",
      });

      const [matrix] = await db.select().from(media).where(eq(media.providerId, "603"));
      expect(await anonymous.links.forTitle({ mediaId: matrix?.id ?? "" })).toMatchObject([
        { relation: "followed_by", title: { title: "The Matrix Reloaded" } },
      ]);
      expect(await caller.links.verified()).toMatchObject([
        {
          kind: "sequel_of",
          source: "manual",
          from: { type: "movie", providerId: "604", title: "The Matrix Reloaded" },
          to: { type: "movie", providerId: "603", title: "The Matrix" },
        },
      ]);
    });

    it("links across media types, read from each side", async () => {
      const { caller } = await reviewer();
      await caller.links.add({ from: "/movies/603", to: "/games/113112", kind: "adaptation_of" });

      const [matrix] = await db.select().from(media).where(eq(media.providerId, "603"));
      const [hades] = await db.select().from(media).where(eq(media.providerId, "113112"));
      expect(await anonymous.links.forTitle({ mediaId: matrix?.id ?? "" })).toMatchObject([
        { relation: "based_on", title: { type: "game", title: "Hades" } },
      ]);
      expect(await anonymous.links.forTitle({ mediaId: hades?.id ?? "" })).toMatchObject([
        { relation: "adapted_as", title: { type: "movie", title: "The Matrix" } },
      ]);
    });

    it("refuses a second link between the same two titles, either way round", async () => {
      const { caller } = await reviewer();
      await caller.links.add({ from: "/movies/604", to: "/movies/603", kind: "sequel_of" });

      await expect(
        caller.links.add({ from: "/movies/603", to: "/movies/604", kind: "same_franchise" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await db.select().from(mediaLinks)).toHaveLength(1);
    });

    it("refuses to link a title to itself or to something that is not a title", async () => {
      const { caller } = await reviewer();

      await expect(
        caller.links.add({ from: "/movies/603", to: "/movies/603", kind: "same_franchise" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller.links.add({ from: "/movies/603", to: "/clubs/604", kind: "same_franchise" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await db.select().from(mediaLinks)).toHaveLength(0);
    });

    it("removes a link", async () => {
      const { caller } = await reviewer();
      const { id } = await caller.links.add({
        from: "/movies/604",
        to: "/movies/603",
        kind: "sequel_of",
      });

      await caller.links.remove({ id });

      expect(await caller.links.verified()).toEqual([]);
      await expect(caller.links.remove({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("drops a title's links when the title is deleted", async () => {
      const { caller } = await reviewer();
      await caller.links.add({ from: "/movies/604", to: "/movies/603", kind: "sequel_of" });

      await db.delete(media).where(eq(media.providerId, "604"));

      expect(await db.select().from(mediaLinks)).toHaveLength(0);
    });
  });
});

describe("parseTitleAddress", () => {
  it("reads a title from a path or a full address", () => {
    expect(parseTitleAddress("/movies/603")).toEqual({ type: "movie", providerId: "603" });
    expect(parseTitleAddress(" https://yousiverse.com/tv/95396/seasons/1 ")).toEqual({
      type: "tv",
      providerId: "95396",
    });
    expect(parseTitleAddress("games/113112?from=search")).toEqual({
      type: "game",
      providerId: "113112",
    });
    expect(parseTitleAddress("/books/OL20893680W")).toEqual({
      type: "book",
      providerId: "OL20893680W",
    });
  });

  it("answers null for anything else", () => {
    expect(parseTitleAddress("")).toBeNull();
    expect(parseTitleAddress("The Matrix")).toBeNull();
    expect(parseTitleAddress("/clubs/603")).toBeNull();
    expect(parseTitleAddress("/movies/abc")).toBeNull();
    expect(parseTitleAddress("/books/603")).toBeNull();
    expect(parseTitleAddress("/xmovies/603")).toBeNull();
  });
});

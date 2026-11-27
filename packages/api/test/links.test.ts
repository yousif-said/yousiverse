import { db } from "@yousiverse/db";
import {
  type LinkKind,
  linkChecks,
  linkSuggestions,
  media,
  mediaLinks,
  universes,
  users,
} from "@yousiverse/db/schema";
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
        () => caller.links.nameUniverse({ mediaId: id, name: "Dune", description: null }),
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

      expect(await anonymous.links.universeOf({ mediaId: matrixId })).toBeNull();
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
      const noArtwork = {
        posterUrl: null,
        backdropUrl: null,
        artHue: null,
        artSaturation: null,
        posterAspect: null,
      };
      expect(pending).toEqual([
        {
          id: expect.any(String),
          kind: "same_franchise",
          reversed: false,
          title: {
            type: "game",
            providerId: "113112",
            title: "Hades",
            releaseYear: null,
            ...noArtwork,
          },
          target: { type: "game", providerId: "228525", title: "Hades II", ...noArtwork },
        },
      ]);
    });

    it("shows the other title's artwork once that title is in the catalog", async () => {
      const { caller } = await reviewer();
      await addTitle(HADES);
      await caller.links.check();
      await db.insert(media).values({
        type: "game",
        title: "Hades II",
        provider: "igdb",
        providerId: "228525",
        posterUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/hades-ii.jpg",
        artHue: 150,
      });

      const { pending } = await caller.links.suggestions();

      expect(pending).toHaveLength(1);
      expect(pending[0]?.target).toMatchObject({
        title: "Hades II",
        posterUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/hades-ii.jpg",
        artHue: 150,
      });
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
      const universe = await anonymous.links.universe({ id: matrixId });
      expect(universe.titles).toHaveLength(2);
      expect(universe.titles).toContainEqual(
        expect.objectContaining({
          type: "movie",
          providerId: "604",
          title: "The Matrix Reloaded",
          releaseYear: 2003,
          posterUrl: expect.stringContaining("https://"),
        }),
      );
      expect(universe.links).toEqual([
        { fromMediaId: reloaded?.id, toMediaId: matrixId, kind: "sequel_of" },
      ]);
      expect(await anonymous.links.universe({ id: reloaded?.id ?? "" })).toEqual(universe);
      expect(await anonymous.links.universes()).toHaveLength(1);
      expect(await db.select().from(mediaLinks)).toMatchObject([
        { fromMediaId: reloaded?.id, toMediaId: matrixId, source: "wikidata", verifiedBy: user.id },
      ]);
      expect((await caller.links.suggestions()).pending).toEqual([]);
    });

    it("keeps a rejected suggestion hidden and does not raise it again", async () => {
      const { caller } = await reviewer();
      const { matrixId, suggestionId } = await suggestSequel();

      await caller.links.reject({ id: suggestionId });

      expect(await anonymous.links.universeOf({ mediaId: matrixId })).toBeNull();
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
      expect(await anonymous.links.universe({ id: matrix?.id ?? "" })).toMatchObject({
        titles: [{ title: "The Matrix" }, { title: "The Matrix Reloaded" }],
        links: [{ toMediaId: matrix?.id, kind: "sequel_of" }],
      });
      expect(await caller.links.verified()).toMatchObject([
        {
          kind: "sequel_of",
          source: "manual",
          from: { type: "movie", providerId: "604", title: "The Matrix Reloaded" },
          to: { type: "movie", providerId: "603", title: "The Matrix" },
        },
      ]);
    });

    it("links across media types, found from either title", async () => {
      const { caller } = await reviewer();
      await caller.links.add({ from: "/movies/603", to: "/games/113112", kind: "adaptation_of" });

      const [matrix] = await db.select().from(media).where(eq(media.providerId, "603"));
      const [hades] = await db.select().from(media).where(eq(media.providerId, "113112"));
      for (const title of [matrix, hades]) {
        const universe = await anonymous.links.universe({ id: title?.id ?? "" });
        expect(universe.links).toEqual([
          { fromMediaId: matrix?.id, toMediaId: hades?.id, kind: "adaptation_of" },
        ]);
        expect(universe.titles.map(({ type, title }) => `${type}: ${title}`).sort()).toEqual([
          "game: Hades",
          "movie: The Matrix",
        ]);
      }
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

describe("universes", () => {
  const NOVEL = { type: "book", title: "Dune", releaseYear: 1965 } as const;
  const MESSIAH = { type: "book", title: "Dune Messiah", releaseYear: 1969 } as const;
  const FILM = {
    type: "movie",
    title: "Dune",
    releaseYear: 2021,
    releaseDate: "2021-10-22",
  } as const;
  const PART_TWO = {
    ...FILM,
    title: "Dune: Part Two",
    releaseYear: 2024,
    releaseDate: "2024-03-01",
  };

  let nextProviderId = 1;
  /** Adds a title that has a page. Only what a test says about it matters. */
  function addPaged(values: Omit<typeof media.$inferInsert, "provider" | "providerId">) {
    const provider = values.type === "book" ? "open_library" : "tmdb";
    return addTitle({ ...values, provider, providerId: `test-${nextProviderId++}` });
  }

  async function link(fromMediaId: string, toMediaId: string, kind: LinkKind = "sequel_of") {
    await db.insert(mediaLinks).values({ fromMediaId, toMediaId, kind, source: "manual" });
  }

  /** A novel, its sequel, and two films of it, linked in a loop as real franchises are. */
  async function addDune() {
    const novel = await addPaged(NOVEL);
    const messiah = await addPaged(MESSIAH);
    const film = await addPaged(FILM);
    const partTwo = await addPaged(PART_TWO);
    await link(partTwo, film, "sequel_of");
    await link(partTwo, novel, "adaptation_of");
    await link(film, novel, "adaptation_of");
    await link(messiah, novel, "sequel_of");
    return { novel, messiah, film, partTwo };
  }

  /** Two titles and the link between them: the smallest universe there is. */
  async function addPair(first: string, second: string) {
    const earlier = await addPaged({ type: "game", title: first, releaseYear: 2020 });
    const later = await addPaged({ type: "game", title: second, releaseYear: 2025 });
    await link(later, earlier);
    return { earlier, later };
  }

  const idsOf = (titles: { mediaId: string }[]) => titles.map((title) => title.mediaId);

  beforeEach(async () => {
    await db.delete(media);
    await db.delete(users);
  });

  describe("one universe", () => {
    it("joins titles linked directly or through others, oldest first", async () => {
      const dune = await addDune();

      const universe = await anonymous.links.universe({ id: dune.novel });

      // The novel has only a year, and still comes before the films that have full dates.
      expect(universe).toMatchObject({ id: dune.novel, name: "Dune", description: null });
      expect(idsOf(universe.titles)).toEqual([dune.novel, dune.messiah, dune.film, dune.partTwo]);
      expect(universe.titles[2]).toEqual({
        mediaId: dune.film,
        type: "movie",
        providerId: expect.stringContaining("test-"),
        title: "Dune",
        releaseYear: 2021,
        releaseDate: "2021-10-22",
        posterUrl: null,
        backdropUrl: null,
        artHue: null,
        artSaturation: null,
        posterAspect: null,
      });
      expect(universe.links).toHaveLength(4);
      expect(universe.links).toContainEqual({
        fromMediaId: dune.film,
        toMediaId: dune.novel,
        kind: "adaptation_of",
      });
    });

    it("answers for the whole universe whichever of its titles is asked about", async () => {
      const dune = await addDune();
      const fromOldest = await anonymous.links.universe({ id: dune.novel });

      for (const mediaId of [dune.messiah, dune.film, dune.partTwo]) {
        const universe = await anonymous.links.universe({ id: mediaId });
        expect(universe.id).toBe(dune.novel);
        expect(universe.titles).toEqual(fromOldest.titles);
        expect(universe.links).toHaveLength(4);
        expect(await anonymous.links.universeOf({ mediaId })).toEqual({
          id: dune.novel,
          name: "Dune",
        });
      }
    });

    it("keeps its address when an older title is linked later", async () => {
      const dune = await addDune();
      const older = await addPaged({ type: "book", title: "Dune World", releaseYear: 1963 });
      await link(dune.novel, older);

      const universe = await anonymous.links.universe({ id: dune.novel });

      expect(universe).toMatchObject({ id: older, name: "Dune World" });
      expect(universe.titles).toHaveLength(5);
    });

    it("is not found for a title that stands alone or an id that is no title", async () => {
      const alone = await addTitle(MATRIX);
      const nothing = crypto.randomUUID();

      for (const id of [alone, nothing]) {
        await expect(anonymous.links.universe({ id })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        expect(await anonymous.links.universeOf({ mediaId: id })).toBeNull();
      }
      expect(await anonymous.links.universes()).toEqual([]);
    });

    it("orders a year by date, then by name: a bare year first, no year at all last", async () => {
      const undated = await addPaged({ type: "movie", title: "Announced" });
      const yearOnly = await addPaged({ type: "book", title: "Annex", releaseYear: 2020 });
      const june = await addPaged({
        ...FILM,
        title: "June",
        releaseYear: 2020,
        releaseDate: "2020-06-01",
      });
      const zed = await addPaged({
        ...FILM,
        title: "Zed",
        releaseYear: 2020,
        releaseDate: "2020-01-01",
      });
      const alpha = await addPaged({
        ...FILM,
        title: "Alpha",
        releaseYear: 2020,
        releaseDate: "2020-01-01",
      });
      const earlier = await addPaged({ type: "game", title: "Earlier", releaseYear: 2019 });
      for (const other of [yearOnly, june, zed, alpha, earlier]) await link(undated, other);

      const universe = await anonymous.links.universe({ id: undated });

      expect(idsOf(universe.titles)).toEqual([earlier, yearOnly, alpha, zed, june, undated]);
      expect(universe.id).toBe(earlier);
    });

    it("leaves out a title that has no page, and the links to it", async () => {
      const dune = await addDune();
      const pageless = await addTitle({ type: "game", title: "Dune II", releaseYear: 1992 });
      await link(pageless, dune.novel, "same_franchise");
      const alone = await addTitle(MATRIX);
      await link(alone, pageless, "same_franchise");

      const universe = await anonymous.links.universe({ id: dune.novel });

      expect(universe.titles).toHaveLength(5);
      expect(idsOf(universe.titles)).not.toContain(pageless);
      expect(universe.links).toHaveLength(4);
    });

    it("comes apart when the link that held it together is removed", async () => {
      const { caller } = await reviewer();
      const dune = await addDune();
      const [toMessiah] = await db
        .select({ id: mediaLinks.id })
        .from(mediaLinks)
        .where(eq(mediaLinks.fromMediaId, dune.messiah));

      await caller.links.remove({ id: toMessiah?.id ?? "" });

      expect(await anonymous.links.universeOf({ mediaId: dune.messiah })).toBeNull();
      expect((await anonymous.links.universe({ id: dune.novel })).titles).toHaveLength(3);
    });
  });

  describe("suggestions", () => {
    it("never shows a title that is only suggested, whatever was decided about it", async () => {
      const dune = await addDune();
      const prophecy = await addTitle({
        type: "tv",
        title: "Dune: Prophecy",
        provider: "tmdb",
        providerId: "90228",
        releaseYear: 2024,
      });
      const matrix = await addTitle(MATRIX);
      const suggestion = {
        targetType: "tv",
        targetProviderId: "90228",
        targetTitle: "Dune: Prophecy",
        kind: "same_franchise",
      } as const;
      await db.insert(linkSuggestions).values([
        { ...suggestion, mediaId: dune.novel, state: "pending" },
        { ...suggestion, mediaId: dune.film, state: "rejected" },
        { ...suggestion, mediaId: matrix, state: "pending" },
      ]);

      const all = await anonymous.links.universes();

      expect(all).toHaveLength(1);
      expect(idsOf(all[0]?.titles ?? [])).toEqual([
        dune.novel,
        dune.messiah,
        dune.film,
        dune.partTwo,
      ]);
      expect(idsOf((await anonymous.links.universe({ id: dune.film })).titles)).not.toContain(
        prophecy,
      );
      for (const mediaId of [prophecy, matrix]) {
        expect(await anonymous.links.universeOf({ mediaId })).toBeNull();
        await expect(anonymous.links.universe({ id: mediaId })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
    });
  });

  describe("the index", () => {
    it("lists every universe, the largest first and then by name", async () => {
      const dune = await addDune();
      const zelda = await addPair("Breath of the Wild", "Tears of the Kingdom");
      const hades = await addPair("Hades", "Hades II");
      await db.insert(universes).values({
        mediaId: zelda.later,
        name: "The Legend of Zelda",
        description: "Hyrule, twice over.",
      });

      const all = await anonymous.links.universes();

      expect(all.map(({ id, name, description }) => ({ id, name, description }))).toEqual([
        { id: dune.novel, name: "Dune", description: null },
        { id: hades.earlier, name: "Hades", description: null },
        { id: zelda.earlier, name: "The Legend of Zelda", description: "Hyrule, twice over." },
      ]);
      expect(all.map((universe) => idsOf(universe.titles))).toEqual([
        [dune.novel, dune.messiah, dune.film, dune.partTwo],
        [hades.earlier, hades.later],
        [zelda.earlier, zelda.later],
      ]);
      expect(all[1]?.titles[1]).toEqual({
        mediaId: hades.later,
        type: "game",
        providerId: expect.stringContaining("test-"),
        title: "Hades II",
        releaseYear: 2025,
        releaseDate: null,
        posterUrl: null,
        backdropUrl: null,
        artHue: null,
        artSaturation: null,
        posterAspect: null,
      });
    });

    it("agrees with what each universe says about itself", async () => {
      await addDune();
      await addPair("Hades", "Hades II");

      for (const listed of await anonymous.links.universes()) {
        const {
          links: _links,
          named: _named,
          ...itself
        } = await anonymous.links.universe({
          id: listed.id,
        });
        expect(listed).toEqual(itself);
      }
    });
  });

  describe("names", () => {
    const NAMING = { name: "Dune", description: "Frank Herbert's desert planet." };

    it("lets a reviewer name a universe from any of its titles", async () => {
      const { caller, user } = await reviewer();
      const dune = await addDune();
      expect(await anonymous.links.universe({ id: dune.film })).toMatchObject({ named: false });

      const saved = await caller.links.nameUniverse({
        mediaId: dune.film,
        name: "  Arrakis ",
        description: ` ${NAMING.description} `,
      });

      expect(saved).toEqual({ id: dune.novel, name: "Arrakis", description: NAMING.description });
      expect(await anonymous.links.universe({ id: dune.partTwo })).toMatchObject({
        id: dune.novel,
        name: "Arrakis",
        description: NAMING.description,
        named: true,
      });
      expect(await anonymous.links.universeOf({ mediaId: dune.messiah })).toEqual({
        id: dune.novel,
        name: "Arrakis",
      });
      expect(await db.select().from(universes)).toMatchObject([
        { mediaId: dune.novel, name: "Arrakis", updatedBy: user.id },
      ]);
    });

    it("rewrites the name it has instead of adding another", async () => {
      const { caller } = await reviewer();
      const dune = await addDune();
      await db.insert(universes).values({ ...NAMING, mediaId: dune.film });

      await caller.links.nameUniverse({ mediaId: dune.messiah, name: "Arrakis", description: "" });

      expect(await db.select().from(universes)).toMatchObject([
        { mediaId: dune.film, name: "Arrakis", description: null },
      ]);
      expect(await anonymous.links.universe({ id: dune.novel })).toMatchObject({
        name: "Arrakis",
        description: null,
      });
    });

    it("goes by the older name when two named universes are linked, until it is named again", async () => {
      const { caller } = await reviewer();
      const first = await addPair("Hollow Knight", "Silksong");
      const second = await addPair("Hades", "Hades II");
      await db.insert(universes).values([
        { mediaId: second.later, name: "Underworld", updatedAt: new Date("2026-02-01") },
        { mediaId: first.earlier, name: "Hallownest", updatedAt: new Date("2026-01-01") },
      ]);
      await link(second.earlier, first.later, "same_franchise");

      expect(await anonymous.links.universes()).toMatchObject([{ name: "Hallownest" }]);
      expect(await anonymous.links.universe({ id: second.later })).toMatchObject({
        name: "Hallownest",
      });

      await caller.links.nameUniverse({ mediaId: second.later, name: "Both", description: null });

      expect(await anonymous.links.universe({ id: first.earlier })).toMatchObject({ name: "Both" });
      expect(await db.select().from(universes)).toMatchObject([
        { mediaId: first.earlier, name: "Both" },
      ]);
    });

    it("keeps a name with its own universe", async () => {
      const dune = await addDune();
      const hades = await addPair("Hades", "Hades II");
      await db.insert(universes).values({ ...NAMING, name: "Arrakis", mediaId: dune.partTwo });

      expect(await anonymous.links.universe({ id: hades.later })).toMatchObject({
        name: "Hades",
        description: null,
        named: false,
      });
    });

    it("lets nobody else name one", async () => {
      const visitor = await signedInAs("Visitor");
      const dune = await addDune();
      const naming = { ...NAMING, mediaId: dune.novel };

      await expect(visitor.caller.links.nameUniverse(naming)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(anonymous.links.nameUniverse(naming)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      expect(await db.select().from(universes)).toEqual([]);
    });

    it("refuses a name for a title that stands alone, and a name that is empty", async () => {
      const { caller } = await reviewer();
      const dune = await addDune();
      const alone = await addTitle(MATRIX);

      await expect(caller.links.nameUniverse({ ...NAMING, mediaId: alone })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        caller.links.nameUniverse({ ...NAMING, mediaId: dune.novel, name: "   " }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await db.select().from(universes)).toEqual([]);
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

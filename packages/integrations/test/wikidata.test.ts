import { describe, expect, it } from "vitest";
import { findBySlugs, getSlug } from "../src/igdb";
import { getRelatedTitles, relatedTitlesQuery } from "../src/wikidata";

describe("wikidata.getRelatedTitles", () => {
  it("lists what a movie is connected to, each work once under its closest relation", async () => {
    const related = await getRelatedTitles({ type: "movie", providerId: "603" });

    // Wikidata names The Matrix Reloaded as what follows, as part of the series, and as part of
    // the franchise; only the first is kept.
    expect(related.filter((other) => other.providerId === "604")).toEqual([
      {
        relation: "followed_by",
        title: "The Matrix Reloaded",
        type: "movie",
        providerId: "604",
        igdbSlug: null,
      },
    ]);
    expect(related).toContainEqual(
      expect.objectContaining({ relation: "basis_for", title: "The Animatrix", type: "movie" }),
    );
    expect(related).toContainEqual({
      relation: "same_franchise",
      title: "Enter the Matrix",
      type: "game",
      providerId: null,
      igdbSlug: "enter-the-matrix",
    });
  });

  it("orders the closest relations first", async () => {
    const related = await getRelatedTitles({ type: "movie", providerId: "603" });

    expect([...new Set(related.map((other) => other.relation))]).toEqual([
      "basis_for",
      "followed_by",
      "same_franchise",
    ]);
  });

  it("leaves out works that are not catalog entries, such as one edition of a book", async () => {
    const related = await getRelatedTitles({ type: "movie", providerId: "603" });

    expect(related.map((other) => other.title)).not.toContain("The Matrix Comics");
    expect(related.every((other) => other.providerId || other.igdbSlug)).toBe(true);
  });

  it("finds a game by the slug IGDB uses for it", async () => {
    expect(
      await getRelatedTitles({ type: "game", providerId: "113112", igdbSlug: "hades--1" }),
    ).toEqual([
      {
        relation: "same_franchise",
        title: "Hades II",
        type: "game",
        providerId: null,
        igdbSlug: "hades-ii",
      },
    ]);
  });

  it("answers with nothing for a title Wikidata connects to nothing", async () => {
    expect(await getRelatedTitles({ type: "tv", providerId: "95396" })).toEqual([]);
    expect(await getRelatedTitles({ type: "book", providerId: "OL20893680W" })).toEqual([]);
    expect(await getRelatedTitles({ type: "movie", providerId: "999999999" })).toEqual([]);
  });
});

describe("wikidata.relatedTitlesQuery", () => {
  it("refuses ids that could change the query", () => {
    expect(() => relatedTitlesQuery({ type: "movie", providerId: '603" . ?s ?p ?o' })).toThrow(
      "Not a movie id",
    );
    expect(() => relatedTitlesQuery({ type: "book", providerId: "603" })).toThrow("Not a book id");
    expect(() => relatedTitlesQuery({ type: "game", providerId: "1", igdbSlug: 'a" } #' })).toThrow(
      "Not an IGDB slug",
    );
  });
});

describe("igdb slugs", () => {
  it("reads the slug of a game, and null for a game that does not exist", async () => {
    expect(await getSlug("113112")).toBe("hades--1");
    expect(await getSlug("999999999")).toBeNull();
  });

  it("finds games by slug", async () => {
    const found = await findBySlugs(["hades-ii"]);

    expect(found.get("hades-ii")).toMatchObject({
      type: "game",
      providerId: "228525",
      title: "Hades II",
    });
  });

  it("asks nothing when there are no usable slugs", async () => {
    expect(await findBySlugs([])).toEqual(new Map());
    expect(await findBySlugs(['bad"slug'])).toEqual(new Map());
  });
});

import { describe, expect, it } from "vitest";
import {
  directRelations,
  isLinkKind,
  mapLayout,
  pageLead,
  relationTo,
  suggestionSides,
  tileLead,
  universePath,
  universeProgress,
  universeTitle,
} from "./links";

describe("suggestionSides", () => {
  it("keeps the titles in order for a suggestion about the title itself", () => {
    expect(suggestionSides({ reversed: false, title: "Dune (film)", target: "Dune" })).toEqual([
      "Dune (film)",
      "Dune",
    ]);
  });

  it("swaps them when the suggestion is about the other title", () => {
    expect(
      suggestionSides({ reversed: true, title: "The Matrix", target: "The Matrix Reloaded" }),
    ).toEqual(["The Matrix Reloaded", "The Matrix"]);
  });
});

describe("isLinkKind", () => {
  it("accepts the three kinds of link and nothing else", () => {
    expect(isLinkKind("adaptation_of")).toBe(true);
    expect(isLinkKind("sequel_of")).toBe(true);
    expect(isLinkKind("same_franchise")).toBe(true);
    expect(isLinkKind("prequel_of")).toBe(false);
    expect(isLinkKind(null)).toBe(false);
  });
});

describe("universePath", () => {
  it("is the universe's place under Youniverses", () => {
    expect(universePath("41ce6aea")).toBe("/youniverses/41ce6aea");
  });
});

describe("universeTitle", () => {
  it("adds an article only to a name that has none", () => {
    expect(universeTitle("Dune")).toBe("The Dune universe");
    expect(universeTitle("The Matrix")).toBe("The Matrix universe");
    expect(universeTitle("the witcher")).toBe("the witcher universe");
    expect(universeTitle("Theros")).toBe("The Theros universe");
  });
});

// Each link reads from the later title to the one it is based on or follows.
const LINKS = [
  { fromMediaId: "messiah", toMediaId: "novel", kind: "sequel_of" },
  { fromMediaId: "film", toMediaId: "novel", kind: "adaptation_of" },
  { fromMediaId: "part-two", toMediaId: "novel", kind: "adaptation_of" },
  { fromMediaId: "part-two", toMediaId: "film", kind: "sequel_of" },
  { fromMediaId: "game", toMediaId: "novel", kind: "same_franchise" },
] as const;
const TITLES = ["novel", "messiah", "film", "part-two", "game"].map((mediaId) => ({ mediaId }));

describe("relationTo", () => {
  it("says what the other title is to this one, from either end of a link", () => {
    expect(relationTo([...LINKS], "film", "novel")).toBe("Based on");
    expect(relationTo([...LINKS], "novel", "film")).toBe("Adapted as");
    expect(relationTo([...LINKS], "part-two", "film")).toBe("Before this");
    expect(relationTo([...LINKS], "film", "part-two")).toBe("After this");
  });

  it("calls everything else the same universe", () => {
    expect(relationTo([...LINKS], "novel", "game")).toBe("Same universe");
    expect(relationTo([...LINKS], "game", "novel")).toBe("Same universe");
    expect(relationTo([...LINKS], "messiah", "part-two")).toBe("Same universe");
  });
});

describe("directRelations", () => {
  it("groups the titles a title is linked to, in a fixed order", () => {
    expect(directRelations([...LINKS], TITLES, "novel")).toEqual([
      { relation: "Adapted as", titles: [{ mediaId: "film" }, { mediaId: "part-two" }] },
      { relation: "After this", titles: [{ mediaId: "messiah" }] },
      { relation: "Same universe", titles: [{ mediaId: "game" }] },
    ]);
    expect(directRelations([...LINKS], TITLES, "part-two")).toEqual([
      { relation: "Based on", titles: [{ mediaId: "novel" }] },
      { relation: "Before this", titles: [{ mediaId: "film" }] },
    ]);
  });

  it("leaves out titles joined only by way of others", () => {
    expect(directRelations([...LINKS], TITLES, "messiah")).toEqual([
      { relation: "Before this", titles: [{ mediaId: "novel" }] },
    ]);
  });
});

describe("universeProgress", () => {
  it("counts what is finished, under way, and wanted", () => {
    const status = new Map([
      ["novel", "finished"],
      ["film", "finished"],
      ["part-two", "in_progress"],
      ["messiah", "want"],
      ["elsewhere", "finished"],
    ] as const);

    expect(universeProgress(TITLES, status)).toEqual({
      total: 5,
      finished: 2,
      started: 1,
      wanted: 1,
    });
  });

  it("is all zeros for a visitor", () => {
    expect(universeProgress(TITLES, new Map())).toEqual({
      total: 5,
      finished: 0,
      started: 0,
      wanted: 0,
    });
  });
});

describe("mapLayout", () => {
  it("has a column per year in order and a lane per medium that occurs", () => {
    const layout = mapLayout([
      { type: "movie", releaseYear: 2021 },
      { type: "book", releaseYear: 1965 },
      { type: "game", releaseYear: 2021 },
      { type: "book", releaseYear: 1969 },
    ]);

    expect(layout).toEqual({ years: [1965, 1969, 2021], lanes: ["book", "movie", "game"] });
  });

  it("gives titles with no year one last column", () => {
    const layout = mapLayout([
      { type: "tv", releaseYear: null },
      { type: "movie", releaseYear: 2026 },
      { type: "movie", releaseYear: null },
    ]);

    expect(layout).toEqual({ years: [2026, null], lanes: ["movie", "tv"] });
  });
});

describe("the title a universe is colored and lit by", () => {
  const grey = { artSaturation: 12, backdropUrl: null };
  const vivid = { artSaturation: 64, backdropUrl: null };
  const dullScreen = { artSaturation: 35, backdropUrl: "dull.jpg" };
  const vividScreen = { artSaturation: 58, backdropUrl: "vivid.jpg" };

  it("colors a tile by the first title with much color, or else the first title", () => {
    expect(tileLead([grey, dullScreen, vivid])).toBe(dullScreen);
    expect(tileLead([grey, { ...grey, artSaturation: null }])).toBe(grey);
    expect(tileLead([])).toBeUndefined();
  });

  it("lights a page by a colorful backdrop, then any backdrop, then the first title", () => {
    expect(pageLead([vivid, dullScreen, vividScreen])).toBe(vividScreen);
    expect(pageLead([vivid, dullScreen])).toBe(dullScreen);
    expect(pageLead([grey, vivid])).toBe(grey);
  });
});

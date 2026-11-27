import { describe, expect, it } from "vitest";
import { type PaletteSources, paletteGroups } from "./palette-items";

const TODAY = "2026-11-26";
const signedIn = { signedIn: true, today: TODAY };
const visitor = { signedIn: false, today: TODAY };

const art = { releaseYear: 2021, posterUrl: null } as const;
const mine: PaletteSources = {
  lists: [{ id: "l1", name: "Desert planets", itemCount: 1 }],
  clubs: [{ id: "c1", name: "Dune readers", memberCount: 12 }],
  universes: [
    { id: "u1", name: "Dune", titles: [1, 2, 3] },
    { id: "u2", name: "The Witcher", titles: [1] },
  ],
};

/** Each group as its label and the names of its rows. */
const outline = (groups: ReturnType<typeof paletteGroups>) =>
  groups.map((group) => [group.label, group.items.map((item) => item.name)]);

describe("paletteGroups with nothing typed", () => {
  it("lists what is under way, the places in the app, and the person's lists and clubs", () => {
    const groups = paletteGroups(
      "",
      {
        ...mine,
        underWay: [
          {
            type: "tv",
            providerId: "95396",
            title: "Severance",
            ...art,
            progress: {
              kind: "episodes",
              watched: 16,
              total: 20,
              next: {
                seasonNumber: 2,
                episodeNumber: 7,
                name: "Chikhai Bardo",
                airDate: "2026-11-20",
                inSeason: 10,
                watchedInSeason: 6,
              },
            },
          },
          { type: "game", providerId: "1", title: "A Game", ...art, progress: null },
          ...["2", "3", "4"].map((providerId) => ({
            type: "movie" as const,
            providerId,
            title: `Film ${providerId}`,
            ...art,
            progress: null,
          })),
        ],
      },
      signedIn,
    );

    expect(outline(groups)).toEqual([
      // Only the four touched most recently.
      ["Pick up where you left off", ["Severance", "A Game", "Film 2", "Film 3"]],
      [
        "Go to",
        [
          "Home",
          "Library",
          "Youniverses",
          "For you",
          "Calendar",
          "Feed",
          "Clubs",
          "Lists",
          "Alerts",
          "Import",
          "Account",
        ],
      ],
      ["Lists and clubs", ["Desert planets", "Dune readers"]],
    ]);
    expect(groups[0]?.items.slice(0, 2)).toEqual([
      {
        key: "title:tv:95396",
        href: "/tv/95396",
        lead: { kind: "title", title: expect.objectContaining({ title: "Severance" }) },
        name: "Severance",
        sub: "Season 2, episode 7 is next",
      },
      expect.objectContaining({ href: "/games/1", sub: "Game" }),
    ]);
    expect(groups[2]?.items.map((item) => [item.href, item.sub])).toEqual([
      ["/lists/l1", "List · 1 title"],
      ["/clubs/c1", "Club · 12 members"],
    ]);
  });

  it("offers a visitor only what is open to all, and the way in", () => {
    expect(outline(paletteGroups("", {}, visitor))).toEqual([
      ["Go to", ["Home", "Youniverses", "Calendar", "Clubs", "Sign in"]],
    ]);
  });
});

describe("paletteGroups with text typed", () => {
  it("groups what matches, and ends with the way to the search page", () => {
    const groups = paletteGroups(
      "dune",
      {
        ...mine,
        titles: {
          unavailable: [],
          results: [
            {
              type: "movie",
              providerId: "438631",
              title: "Dune",
              ...art,
              status: "finished",
            },
            {
              type: "book",
              providerId: "OL893415W",
              title: "Dune",
              releaseYear: 1965,
              posterUrl: null,
              authors: ["Frank Herbert", "Someone Else"],
              status: null,
            },
            { type: "tv", providerId: "90228", title: "Dune: Prophecy", ...art, status: null },
            {
              type: "game",
              providerId: "7",
              title: "Dune II",
              ...art,
              releaseYear: null,
              status: null,
            },
          ],
        },
        people: [
          { username: "dune_fan", name: "Paul A." },
          { username: "mara", name: "Mara Dune" },
        ],
        following: ["mara"],
      },
      signedIn,
    );

    expect(outline(groups)).toEqual([
      ["Titles", ["Dune", "Dune", "Dune: Prophecy", "Dune II"]],
      ["People", ["Paul A.", "Mara Dune"]],
      ["Youniverses", ["Dune"]],
      ["Lists and clubs", ["Dune readers"]],
      [null, ["Search everything for “dune”"]],
    ]);
    expect(groups[0]?.items.map((item) => [item.href, item.sub])).toEqual([
      ["/movies/438631", "Movie · 2021 · Watched"],
      ["/books/OL893415W", "Book · 1965 · Frank Herbert"],
      ["/tv/90228", "Show · 2021"],
      ["/games/7", "Game · TBA"],
    ]);
    expect(groups[1]?.items.map((item) => [item.href, item.sub, item.lead])).toEqual([
      ["/u/dune_fan", "@dune_fan", { kind: "person", username: "dune_fan" }],
      ["/u/mara", "@mara · Following", { kind: "person", username: "mara" }],
    ]);
    expect(groups[2]?.items[0]).toMatchObject({
      href: "/youniverses/u1",
      sub: "Universe · 3 titles",
    });
    expect(groups.at(-1)?.items[0]).toMatchObject({
      href: "/search?q=dune",
      sub: "Movies, shows, games, books, and people",
    });
  });

  it("matches places, lists, and clubs whatever the capitals, and shows seven titles at most", () => {
    const results = Array.from({ length: 9 }, (_, index) => ({
      type: "movie" as const,
      providerId: String(index),
      title: `Film ${index}`,
      ...art,
      status: null,
    }));

    const groups = paletteGroups("LI", { ...mine, titles: { results, unavailable: [] } }, signedIn);

    expect(groups[0]?.items).toHaveLength(7);
    expect(outline(groups).slice(1)).toEqual([
      ["Go to", ["Library", "Lists"]],
      [null, ["Search everything for “LI”"]],
    ]);
  });

  it("always ends with the search row, even when nothing matches", () => {
    expect(outline(paletteGroups("zzzz", mine, signedIn))).toEqual([
      [null, ["Search everything for “zzzz”"]],
    ]);
  });

  it("says which sources did not answer, in place of their titles", () => {
    const partly = paletteGroups(
      "dune",
      { titles: { results: [], unavailable: ["movie", "tv"] } },
      visitor,
    );
    const failed = paletteGroups("dune", { titlesFailed: true }, visitor);

    expect(partly[0]).toEqual({
      label: "Titles",
      items: [],
      note: "Movies and TV could not be searched right now.",
    });
    expect(failed[0]?.note).toBe("Titles could not be searched right now. Try again in a minute.");
  });
});

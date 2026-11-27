import { describe, expect, it } from "vitest";
import {
  byWeek,
  type CalendarEntry,
  calendarPath,
  entryDetail,
  monthGrids,
  spanLabel,
} from "./calendar";

const summary = { releaseYear: null, posterUrl: null, backdropUrl: null } as const;
const noColor = { artHue: null, artSaturation: null, posterAspect: null } as const;

const release = (
  date: string,
  title: string,
  type: "movie" | "game" = "movie",
  platforms: string[] = [],
): CalendarEntry => ({
  kind: "release",
  date,
  title: { mediaId: `id-${title}`, type, providerId: "1", title, ...summary, ...noColor },
  platforms,
});

const episodes = (
  overrides: Partial<Extract<CalendarEntry, { kind: "episodes" }>>,
): CalendarEntry => ({
  kind: "episodes",
  date: "2026-11-20",
  title: {
    mediaId: "id-severance",
    type: "tv",
    providerId: "95396",
    title: "Severance",
    ...summary,
    ...noColor,
  },
  seasonNumber: 2,
  firstEpisode: 4,
  lastEpisode: 4,
  count: 1,
  episodeName: "Woe's Hollow",
  ...overrides,
});

describe("entryDetail", () => {
  it("says where a release comes out, or only that it does", () => {
    expect(entryDetail(release("2026-12-18", "A Film"))).toBe("In theaters");
    expect(entryDetail(release("2026-12-18", "A Game", "game"))).toBe("Release day");
    expect(
      entryDetail(
        release("2026-12-18", "A Game", "game", ["PC", "PlayStation 5", "Xbox", "Switch"]),
      ),
    ).toBe("PC, PlayStation 5, Xbox");
  });

  it("names a single episode, unless its name only repeats its number", () => {
    expect(entryDetail(episodes({}))).toBe("Season 2, episode 4 · Woe's Hollow");
    expect(entryDetail(episodes({ episodeName: null }))).toBe("Season 2, episode 4");
    expect(entryDetail(episodes({ episodeName: "Episode 4" }))).toBe("Season 2, episode 4");
  });

  it("gives the range when several episodes of a season air together", () => {
    expect(
      entryDetail(episodes({ count: 3, firstEpisode: 1, lastEpisode: 3, episodeName: null })),
    ).toBe("Season 2, episodes 1 to 3");
  });

  it("only counts episodes that span seasons, and calls season 0 specials", () => {
    expect(entryDetail(episodes({ count: 5, lastEpisode: null, episodeName: null }))).toBe(
      "5 episodes",
    );
    expect(entryDetail(episodes({ seasonNumber: 0, firstEpisode: 1, episodeName: "Recap" }))).toBe(
      "Specials, episode 1 · Recap",
    );
  });
});

describe("byWeek", () => {
  const named = (entries: CalendarEntry[], today: string) =>
    byWeek(entries, today).map(({ name, days }) => [
      name,
      days.map((day) => [day.date, day.entries.map((entry) => entry.title.title)]),
    ]);

  it("groups entries into this week, next week, and then months, keeping their order", () => {
    // November 26, 2026 is a Thursday, so this week ends on Sunday the 29th.
    const grouped = named(
      [
        release("2026-11-26", "Today"),
        release("2026-11-29", "Sunday"),
        release("2026-11-29", "Also Sunday"),
        release("2026-11-30", "Monday"),
        release("2026-12-06", "Next Sunday"),
        release("2026-12-07", "The Monday after"),
        release("2026-12-31", "New Year's Eve"),
        release("2027-01-01", "New Year's Day"),
      ],
      "2026-11-26",
    );

    expect(grouped).toEqual([
      [
        "This week",
        [
          ["2026-11-26", ["Today"]],
          ["2026-11-29", ["Sunday", "Also Sunday"]],
        ],
      ],
      [
        "Next week",
        [
          ["2026-11-30", ["Monday"]],
          ["2026-12-06", ["Next Sunday"]],
        ],
      ],
      [
        "December",
        [
          ["2026-12-07", ["The Monday after"]],
          ["2026-12-31", ["New Year's Eve"]],
        ],
      ],
      ["January", [["2027-01-01", ["New Year's Day"]]]],
    ]);
  });

  it("ends this week today when today is a Sunday", () => {
    expect(
      named([release("2026-11-29", "Today"), release("2026-11-30", "Tomorrow")], "2026-11-29"),
    ).toEqual([
      ["This week", [["2026-11-29", ["Today"]]]],
      ["Next week", [["2026-11-30", ["Tomorrow"]]]],
    ]);
  });

  it("gives nothing for no entries", () => {
    expect(byWeek([], "2026-11-26")).toEqual([]);
  });
});

describe("spanLabel", () => {
  it("gives one day, or the first and last of several", () => {
    const [week] = byWeek(
      [release("2026-11-26", "First"), release("2026-11-29", "Last")],
      "2026-11-26",
    );

    expect(spanLabel(week?.days ?? [])).toBe("Nov 26 to Nov 29");
    expect(spanLabel(week?.days.slice(0, 1) ?? [])).toBe("Nov 26");
  });
});

describe("monthGrids", () => {
  it("covers every month the window touches, each starting under its weekday", () => {
    const grids = monthGrids("2026-11-26", "2027-02-24");

    expect(
      grids.map(({ name, year, leading, days }) => [name, year, leading, days.length]),
    ).toEqual([
      // November 1, 2026 is a Sunday; December 1 is a Tuesday.
      ["November", 2026, 0, 30],
      ["December", 2026, 2, 31],
      ["January", 2027, 5, 31],
      ["February", 2027, 1, 28],
    ]);
    expect(grids[0]?.days.at(0)).toBe("2026-11-01");
    expect(grids[1]?.days.at(-1)).toBe("2026-12-31");
  });

  it("counts a leap year's February", () => {
    expect(monthGrids("2028-02-10", "2028-02-20")[0]?.days).toHaveLength(29);
  });
});

describe("calendarPath", () => {
  it("builds the address of a filtered calendar", () => {
    expect(calendarPath()).toBe("/calendar");
    expect(calendarPath("catalog")).toBe("/calendar?show=catalog");
    expect(calendarPath("library", "tv")).toBe("/calendar?show=library&type=tv");
    expect(calendarPath(undefined, "game")).toBe("/calendar?type=game");
  });
});

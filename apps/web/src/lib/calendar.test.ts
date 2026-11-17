import { describe, expect, it } from "vitest";
import { byMonth, type CalendarEntry, calendarPath, dayLabel, entryDetail } from "./calendar";

const release = (date: string, title: string): CalendarEntry => ({
  kind: "release",
  date,
  title: { type: "movie", providerId: "1", title },
});

const episodes = (
  overrides: Partial<Extract<CalendarEntry, { kind: "episodes" }>>,
): CalendarEntry => ({
  kind: "episodes",
  date: "2026-11-20",
  title: { type: "tv", providerId: "95396", title: "Severance" },
  seasonNumber: 2,
  firstEpisode: 4,
  lastEpisode: 4,
  count: 1,
  episodeName: "Woe's Hollow",
  ...overrides,
});

describe("dayLabel", () => {
  it("names today and tomorrow, and gives other days in full", () => {
    expect(dayLabel("2026-11-16", "2026-11-16")).toBe("Today");
    expect(dayLabel("2026-11-17", "2026-11-16")).toBe("Tomorrow");
    expect(dayLabel("2026-11-24", "2026-11-16")).toBe("Tuesday, November 24");
  });

  it("counts days across a month's end and a clock change", () => {
    expect(dayLabel("2026-12-01", "2026-11-30")).toBe("Tomorrow");
    expect(dayLabel("2026-11-02", "2026-11-01")).toBe("Tomorrow");
  });
});

describe("entryDetail", () => {
  it("says nothing more about a release", () => {
    expect(entryDetail(release("2026-12-18", "A Film"))).toBeNull();
  });

  it("names a single episode", () => {
    expect(entryDetail(episodes({}))).toBe("Season 2, episode 4: Woe's Hollow");
    expect(entryDetail(episodes({ episodeName: null }))).toBe("Season 2, episode 4");
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
      "Specials, episode 1: Recap",
    );
  });
});

describe("byMonth", () => {
  it("groups entries into months, then days, keeping their order", () => {
    const grouped = byMonth([
      release("2026-11-20", "First"),
      release("2026-11-20", "Second"),
      release("2026-11-28", "Third"),
      release("2026-12-04", "Fourth"),
    ]);

    expect(
      grouped.map(({ month, days }) => [
        month,
        days.map((day) => [day.date, day.entries.map((entry) => entry.title.title)]),
      ]),
    ).toEqual([
      [
        "November 2026",
        [
          ["2026-11-20", ["First", "Second"]],
          ["2026-11-28", ["Third"]],
        ],
      ],
      ["December 2026", [["2026-12-04", ["Fourth"]]]],
    ]);
  });

  it("gives nothing for no entries", () => {
    expect(byMonth([])).toEqual([]);
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

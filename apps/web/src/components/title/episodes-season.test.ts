import { describe, expect, it } from "vitest";
import { hasAired, openingSeason, seasonsToShow } from "./episodes-season";

const TODAY = "2026-11-26";

const season = (seasonNumber: number, ...airDates: (string | null)[]) => ({
  seasonNumber,
  episodes: airDates.map((airDate) => ({ airDate })),
});

const specials = season(0, "2021-12-15");
const first = season(1, "2022-02-17", "2022-02-24");
const second = season(2, "2025-01-16", "2025-01-23");
const airing = season(3, "2026-11-20", "2026-11-27", null);
const announced = season(4);
const stored = [specials, first, second, airing, announced];

describe("hasAired", () => {
  it("counts an episode as out on its air date, by US calendar day", () => {
    expect(hasAired({ airDate: "2026-11-25" }, TODAY)).toBe(true);
    expect(hasAired({ airDate: "2026-11-26" }, TODAY)).toBe(true);
    expect(hasAired({ airDate: "2026-11-27" }, TODAY)).toBe(false);
  });

  it("does not count an episode with no date announced", () => {
    expect(hasAired({ airDate: null }, TODAY)).toBe(false);
  });
});

describe("seasonsToShow", () => {
  it("lists numbered seasons in order, then specials, without seasons that have no episodes", () => {
    expect(seasonsToShow(stored, undefined).map((each) => each.seasonNumber)).toEqual([1, 2, 3, 0]);
  });

  it("keeps a season with no episodes when it is the one asked for", () => {
    expect(seasonsToShow(stored, 4).map((each) => each.seasonNumber)).toEqual([1, 2, 3, 4, 0]);
  });
});

describe("openingSeason", () => {
  const seasons = seasonsToShow(stored, undefined);

  it("opens on the season asked for", () => {
    expect(openingSeason(seasons, { asked: 1, upTo: 2, today: TODAY })).toBe(first);
    expect(openingSeason(seasons, { asked: 0, upTo: 2, today: TODAY })).toBe(specials);
  });

  it("opens on the season the viewer is up to when none is asked for", () => {
    expect(openingSeason(seasons, { asked: undefined, upTo: 2, today: TODAY })).toBe(second);
  });

  it("opens on the latest season that has started airing otherwise", () => {
    expect(openingSeason(seasons, { asked: undefined, upTo: undefined, today: TODAY })).toBe(
      airing,
    );
    expect(openingSeason(seasons, { asked: undefined, upTo: undefined, today: "2026-01-01" })).toBe(
      second,
    );
  });

  it("falls back to the default when the season asked for is not one of the show's", () => {
    expect(openingSeason(seasons, { asked: 9, upTo: undefined, today: TODAY })).toBe(airing);
  });

  it("opens on the first season of a show that has not started airing", () => {
    expect(openingSeason(seasons, { asked: undefined, upTo: undefined, today: "2020-01-01" })).toBe(
      first,
    );
  });

  it("never opens on specials unless asked, even when they are all that has aired", () => {
    const upcoming = seasonsToShow([specials, season(1, "2027-03-01")], undefined);

    expect(
      openingSeason(upcoming, { asked: undefined, upTo: undefined, today: TODAY })?.seasonNumber,
    ).toBe(1);
  });

  it("has nothing to open for a show with no seasons", () => {
    expect(openingSeason([], { asked: undefined, upTo: undefined, today: TODAY })).toBeUndefined();
  });
});

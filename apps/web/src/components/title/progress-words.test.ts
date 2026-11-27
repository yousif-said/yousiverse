import { describe, expect, it } from "vitest";
import { hoursOf, progressInWords } from "./progress-words";

const TODAY = "2026-11-26";

function episodes(next: { airDate: string | null; watchedInSeason: number } | null) {
  return {
    kind: "episodes" as const,
    watched: 16,
    total: 20,
    next: next && {
      seasonNumber: 2,
      episodeNumber: 7,
      name: "Chikhai Bardo",
      inSeason: 10,
      ...next,
    },
  };
}

describe("progressInWords", () => {
  it("names the next episode of a show once it has aired, measured within its season", () => {
    expect(progressInWords(episodes({ airDate: "2026-11-20", watchedInSeason: 6 }), TODAY)).toEqual(
      { text: "Season 2, episode 7 is next", value: 60 },
    );
    expect(progressInWords(episodes({ airDate: TODAY, watchedInSeason: 6 }), TODAY).text).toBe(
      "Season 2, episode 7 is next",
    );
  });

  it("says when the next episode airs if it has not yet", () => {
    const text = (airDate: string) =>
      progressInWords(episodes({ airDate, watchedInSeason: 6 }), TODAY).text;

    expect(text("2026-11-27")).toBe("Season 2, episode 7 airs tomorrow");
    expect(text("2026-11-28")).toBe("Season 2, episode 7 airs Saturday");
    expect(text("2026-12-08")).toBe("Season 2, episode 7 airs in 12 days");
  });

  it("says so when the next episode has no date", () => {
    expect(progressInWords(episodes({ airDate: null, watchedInSeason: 6 }), TODAY).text).toBe(
      "Season 2, episode 7 has no date yet",
    );
  });

  it("is all caught up when every episode is watched", () => {
    expect(progressInWords(episodes(null), TODAY)).toEqual({ text: "All caught up", value: 100 });
  });

  it("counts a book's pages against its length when that is known", () => {
    expect(progressInWords({ kind: "pages", read: 141, of: 282 }, TODAY)).toEqual({
      text: "Page 141 of 282",
      value: 50,
    });
    expect(progressInWords({ kind: "pages", read: 141, of: null }, TODAY)).toEqual({
      text: "Page 141",
      value: null,
    });
  });

  it("never fills the bar past the end for an edition longer than the catalog's", () => {
    expect(progressInWords({ kind: "pages", read: 300, of: 282 }, TODAY).value).toBe(100);
  });

  it("gives a game's time in hours, with no bar", () => {
    expect(progressInWords({ kind: "minutes", played: 3720 }, TODAY)).toEqual({
      text: "62 hours played",
      value: null,
    });
    expect(progressInWords({ kind: "minutes", played: 60 }, TODAY).text).toBe("1 hour played");
    expect(progressInWords({ kind: "minutes", played: 90 }, TODAY).text).toBe("1.5 hours played");
  });
});

describe("hoursOf", () => {
  it("rounds minutes to a tenth of an hour", () => {
    expect(hoursOf(3720)).toBe(62);
    expect(hoursOf(100)).toBe(1.7);
    expect(hoursOf(0)).toBe(0);
  });
});

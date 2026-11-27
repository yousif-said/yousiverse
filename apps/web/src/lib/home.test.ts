import { describe, expect, it } from "vitest";
import { arrivalVerb, episodeLabel, greeting, longDay, wallColumns, weekdayDate } from "./home";

describe("greeting", () => {
  it("goes by the time of day in the US, whatever the server's clock says", () => {
    // 9:30 in New York.
    expect(greeting("Sam Rivera", new Date("2026-11-26T14:30:00Z"))).toBe("Good morning, Sam.");
    // 14:00 in New York.
    expect(greeting("Sam Rivera", new Date("2026-11-26T19:00:00Z"))).toBe("Good afternoon, Sam.");
    // 21:00 in New York, already the next day in UTC.
    expect(greeting("Sam Rivera", new Date("2026-11-27T02:00:00Z"))).toBe("Good evening, Sam.");
    // 2:00 in New York is still last night.
    expect(greeting("Sam Rivera", new Date("2026-11-26T07:00:00Z"))).toBe("Good evening, Sam.");
  });

  it("greets a person with no name on their account without one", () => {
    expect(greeting("  ", new Date("2026-11-26T14:30:00Z"))).toBe("Good morning.");
  });
});

describe("days", () => {
  it("writes a calendar day out without shifting it into another time zone", () => {
    expect(longDay("2026-11-26")).toBe("Thursday, November 26");
    expect(weekdayDate("2026-11-28")).toBe("Sat, Nov 28");
  });
});

describe("arrivalVerb", () => {
  const title = { mediaId: "1", providerId: "1", title: "A title", posterUrl: null };
  const release = (type: "movie" | "game") =>
    ({ kind: "release", date: "2026-12-01", title: { ...title, type } }) as Parameters<
      typeof arrivalVerb
    >[0];

  it("fits the kind of thing that is coming", () => {
    expect(arrivalVerb(release("movie"))).toBe("opens");
    expect(arrivalVerb(release("game"))).toBe("is out");
    expect(
      arrivalVerb({ ...release("movie"), kind: "episode", seasonNumber: 2, episodeNumber: 1 }),
    ).toBe("is back");
  });
});

describe("episodeLabel", () => {
  it("names the season and the episode, and calls season 0 the specials", () => {
    expect(episodeLabel(2, 7)).toBe("Season 2, episode 7");
    expect(episodeLabel(0, 3)).toBe("Specials, episode 3");
  });
});

describe("wallColumns", () => {
  it("shifts each round of types along a column, so no column is all one type", () => {
    // Titles arrive dealt by type: a movie, a show, a game, a book, and round again.
    const titles = ["m1", "t1", "g1", "b1", "m2", "t2", "g2", "b2", "m3", "t3", "g3", "b3"];

    expect(wallColumns(titles, 4)).toEqual([
      ["m1", "b2", "g3"],
      ["t1", "m2", "b3"],
      ["g1", "t2", "m3"],
      ["b1", "g2", "t3"],
    ]);
  });

  it("leaves columns empty rather than failing when there are few titles", () => {
    expect(wallColumns(["only"], 4)).toEqual([["only"], [], [], []]);
    expect(wallColumns([], 4)).toEqual([[], [], [], []]);
  });
});

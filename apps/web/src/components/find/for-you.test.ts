import { describe, expect, it } from "vitest";
import { fitLabel, forYouPath, isBudget, togetherLabel } from "./for-you";

describe("isBudget", () => {
  it("knows the four stretches of time and nothing else", () => {
    expect(["hour", "two", "evening", "weekend"].every(isBudget)).toBe(true);
    expect(isBudget("month")).toBe(false);
    expect(isBudget("toString")).toBe(false);
    expect(isBudget(undefined)).toBe(false);
    expect(isBudget(["hour"])).toBe(false);
  });
});

describe("forYouPath", () => {
  it("keeps both choices in the address, leaving out the usual stretch of time", () => {
    expect(forYouPath({ budget: "evening" })).toBe("/recommendations");
    expect(forYouPath({ budget: "hour" })).toBe("/recommendations?budget=hour");
    expect(forYouPath({ budget: "evening", companion: "mara" })).toBe("/recommendations?with=mara");
    expect(forYouPath({ budget: "weekend", companion: "mara" })).toBe(
      "/recommendations?budget=weekend&with=mara",
    );
  });
});

describe("fitLabel", () => {
  it("gives a film's length", () => {
    expect(fitLabel({ kind: "movie", minutes: 106 })).toBe("1h 46m");
  });

  it("names one episode, or counts several and how long they run together", () => {
    const next = { kind: "episodes" as const, seasonNumber: 2, episodeNumber: 7 };

    expect(fitLabel({ ...next, count: 1, minutes: 52 })).toBe("Episode 7, 52m");
    expect(fitLabel({ ...next, count: 5, minutes: 330 })).toBe("5 episodes, about 5h 30m");
  });

  it("counts a book's pages, saying when some are already read", () => {
    expect(fitLabel({ kind: "pages", pages: 444, started: false })).toBe("444 pages");
    expect(fitLabel({ kind: "pages", pages: 138, started: true })).toBe("138 pages left");
    expect(fitLabel({ kind: "pages", pages: 1, started: true })).toBe("1 page left");
  });
});

describe("togetherLabel", () => {
  it("explains each reason, with ratings out of ten", () => {
    expect(togetherLabel({ reason: "you_want_they_rated", rating: 36 }, "mara")).toBe(
      "You want it, mara rated it 9",
    );
    expect(togetherLabel({ reason: "both_want", rating: null }, "mara")).toBe("You both want it");
    expect(togetherLabel({ reason: "you_rated_they_want", rating: 35 }, "mara")).toBe(
      "You rated it 8.75, mara wants it",
    );
    expect(togetherLabel({ reason: "they_rated", rating: 38 }, "mara")).toBe("mara rated it 9.5");
  });
});

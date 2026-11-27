import { describe, expect, it } from "vitest";
import { averageLabel, histogramLabel, isProfileTab, profilePath, profileTabPath } from "./profile";

describe("profilePath", () => {
  it("leads to a profile, with its library filtered when asked", () => {
    expect(profilePath("ada")).toBe("/u/ada");
    expect(profilePath("ada", "game")).toBe("/u/ada?type=game");
    expect(profilePath("ada", "movie", "finished")).toBe("/u/ada?type=movie&status=finished");
  });
});

describe("profileTabPath", () => {
  it("keeps the library at the profile's own address and names every other tab", () => {
    expect(profileTabPath("ada", "library")).toBe("/u/ada");
    expect(profileTabPath("ada", "reviews")).toBe("/u/ada?tab=reviews");
    expect(profileTabPath("ada", "followers")).toBe("/u/ada?tab=followers");
  });
});

describe("isProfileTab", () => {
  it("accepts the five tabs and nothing else", () => {
    expect(["library", "reviews", "lists", "following", "followers"].every(isProfileTab)).toBe(
      true,
    );
    expect(isProfileTab("friends")).toBe(false);
    expect(isProfileTab(undefined)).toBe(false);
    expect(isProfileTab(["reviews"])).toBe(false);
  });
});

describe("averageLabel", () => {
  it("shows quarter points out of ten to one decimal, and a dash for no ratings", () => {
    expect(averageLabel(33.5)).toBe("8.4");
    expect(averageLabel(40)).toBe("10.0");
    expect(averageLabel(null)).toBe("–");
  });
});

describe("histogramLabel", () => {
  it("says how many ratings sit at each half point that has any", () => {
    const histogram = new Array<number>(21).fill(0);
    histogram[14] = 2;
    histogram[17] = 5;

    expect(histogramLabel(histogram)).toBe("Ratings from 0 to 10: 2 at 7, 5 at 8.5");
    expect(histogramLabel(new Array<number>(21).fill(0))).toBe("No ratings yet");
  });
});

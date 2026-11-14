import { describe, expect, it } from "vitest";
import { clubPath, coveredTypes } from "./clubs";

describe("coveredTypes", () => {
  it("names the media a club covers as a phrase", () => {
    expect(coveredTypes(["book"])).toBe("Books");
    expect(coveredTypes(["movie", "tv"])).toBe("Movies and TV");
    expect(coveredTypes(["movie", "tv", "game", "book"])).toBe("Movies, TV, games, and books");
  });
});

describe("clubPath", () => {
  it("adds the invite code only when there is one", () => {
    expect(clubPath("abc")).toBe("/clubs/abc");
    expect(clubPath("abc", null)).toBe("/clubs/abc");
    expect(clubPath("abc", "a b")).toBe("/clubs/abc?invite=a%20b");
  });
});

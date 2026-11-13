import { describe, expect, it } from "vitest";
import { isVisibility, visibilityNote } from "./visibility";

describe("visibilityNote", () => {
  it("says nothing about what everyone can see", () => {
    expect(visibilityNote("public")).toBe("");
  });

  it("notes what is for friends or for the owner alone", () => {
    expect(visibilityNote("friends")).toBe(", friends only");
    expect(visibilityNote("private")).toBe(", only you");
    expect(visibilityNote("private", "visible only to you")).toBe(", visible only to you");
  });
});

describe("isVisibility", () => {
  it("accepts the three levels and nothing else", () => {
    expect(["public", "friends", "private"].every(isVisibility)).toBe(true);
    expect(isVisibility("everyone")).toBe(false);
    expect(isVisibility(null)).toBe(false);
  });
});

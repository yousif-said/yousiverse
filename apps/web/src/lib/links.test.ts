import { describe, expect, it } from "vitest";
import { isLinkKind, suggestionSides } from "./links";

describe("suggestionSides", () => {
  it("keeps the titles in order for a suggestion about the title itself", () => {
    expect(suggestionSides({ reversed: false, title: "Dune (film)", target: "Dune" })).toEqual([
      "Dune (film)",
      "Dune",
    ]);
  });

  it("swaps them when the suggestion is about the other title", () => {
    expect(
      suggestionSides({ reversed: true, title: "The Matrix", target: "The Matrix Reloaded" }),
    ).toEqual(["The Matrix Reloaded", "The Matrix"]);
  });
});

describe("isLinkKind", () => {
  it("accepts the three kinds of link and nothing else", () => {
    expect(isLinkKind("adaptation_of")).toBe(true);
    expect(isLinkKind("sequel_of")).toBe(true);
    expect(isLinkKind("same_franchise")).toBe(true);
    expect(isLinkKind("prequel_of")).toBe(false);
    expect(isLinkKind(null)).toBe(false);
  });
});

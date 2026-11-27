import { describe, expect, it } from "vitest";
import { hueOf } from "./hue";
import { storeGlyph } from "./store-glyphs";

describe("storeGlyph", () => {
  it("finds a store by the words in its name, however the provider spells it", () => {
    expect(storeGlyph("Steam")).not.toBeNull();
    expect(storeGlyph("Epic Game Store")).toBe(storeGlyph("Epic Games Store"));
    expect(storeGlyph("GOG")).toBe(storeGlyph("GOG.com"));
    expect(storeGlyph("Humble Store")).not.toBeNull();
    expect(storeGlyph("Microsoft Store")).not.toBe(storeGlyph("Steam"));
  });

  it("has nothing for a store it does not know, which then shows its initial", () => {
    expect(storeGlyph("Fanatical")).toBeNull();
    expect(storeGlyph("GreenManGaming")).toBeNull();
  });
});

describe("hueOf", () => {
  it("is always the same for the same text and differs between similar names", () => {
    expect(hueOf("mara")).toBe(hueOf("mara"));
    expect(hueOf("mara")).not.toBe(hueOf("marb"));
    for (const name of ["sam", "theo", "priya", ""]) {
      expect(hueOf(name)).toBeGreaterThanOrEqual(0);
      expect(hueOf(name)).toBeLessThan(360);
    }
  });
});

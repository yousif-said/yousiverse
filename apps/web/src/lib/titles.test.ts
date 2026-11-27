import { describe, expect, it } from "vitest";
import { ambientOf, glowStyle, morphName, ratioOf, tonedClass, toneStyle } from "./titles";

describe("ratioOf", () => {
  it("gives each medium its own shape", () => {
    expect(ratioOf({ type: "movie" })).toBeCloseTo(2 / 3, 2);
    expect(ratioOf({ type: "tv" })).toBeCloseTo(16 / 9, 2);
    expect(ratioOf({ type: "game" })).toBe(0.75);
  });

  it("uses a book's own cover shape, within what still looks like a book", () => {
    expect(ratioOf({ type: "book", posterAspect: 709 })).toBe(0.709);
    expect(ratioOf({ type: "book", posterAspect: 1000 })).toBe(0.8);
    expect(ratioOf({ type: "book", posterAspect: 300 })).toBe(0.56);
    expect(ratioOf({ type: "book", posterAspect: null })).toBe(0.66);
  });

  it("ignores a measured shape for media whose shape is fixed", () => {
    expect(ratioOf({ type: "movie", posterAspect: 900 })).toBeCloseTo(2 / 3, 2);
  });
});

describe("toneStyle", () => {
  it("tints with the artwork's hue, keeping saturation where text stays readable", () => {
    expect(toneStyle({ artHue: 29, artSaturation: 95 })).toEqual({
      "--tone-h": 29,
      "--tone-s": 78,
    });
    expect(toneStyle({ artHue: 200, artSaturation: 5 })).toEqual({
      "--tone-h": 200,
      "--tone-s": 22,
    });
  });

  it("leaves the tint alone for artwork that has not been measured", () => {
    expect(toneStyle({ artHue: null, artSaturation: null })).toEqual({});
    expect(toneStyle(null)).toEqual({});
    expect(tonedClass({ artHue: null })).toBeUndefined();
    expect(tonedClass({ artHue: 0 })).toBe("toned");
  });
});

describe("glowStyle", () => {
  it("glows in the artwork's color, and in no color when it has none", () => {
    expect(glowStyle({ artHue: 14, artSaturation: 55 })).toEqual({ "--h": 14, "--s": 55 });
    expect(glowStyle({ artHue: null, artSaturation: null })).toEqual({ "--h": 40, "--s": 0 });
  });
});

describe("ambientOf", () => {
  it("prefers the backdrop and falls back to the poster", () => {
    expect(ambientOf({ posterUrl: "p.jpg", backdropUrl: "b.jpg" })).toBe("b.jpg");
    expect(ambientOf({ posterUrl: "p.jpg", backdropUrl: null })).toBe("p.jpg");
    expect(ambientOf({ posterUrl: null })).toBeNull();
  });
});

describe("morphName", () => {
  it("gives a title one name wherever its artwork is drawn", () => {
    expect(morphName({ type: "movie", providerId: "693134" })).toBe("art-movie-693134");
    expect(morphName({ type: "book", providerId: "OL893415W" })).toBe("art-book-OL893415W");
  });

  it("keeps the name a valid CSS identifier", () => {
    expect(morphName({ type: "book", providerId: "works/OL1.W" })).toBe("art-book-works-OL1-W");
  });

  it("gives a show none, because its page has no poster", () => {
    expect(morphName({ type: "tv", providerId: "95396" })).toBeUndefined();
  });
});

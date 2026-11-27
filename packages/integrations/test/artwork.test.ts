import { describe, expect, it } from "vitest";
import { dominantColor, measureArtwork } from "../src/artwork";

/** Raw RGB pixels: each color repeated `count` times. */
function pixels(...runs: [color: [number, number, number], count: number][]): Uint8Array {
  return new Uint8Array(runs.flatMap(([color, count]) => Array(count).fill(color).flat()));
}

describe("dominantColor", () => {
  it("finds the hue most of the colored area shares", () => {
    const mostlyOrange = pixels([[230, 120, 20], 70], [[20, 60, 220], 30]);

    const { hue, saturation } = dominantColor(mostlyOrange);

    expect(hue).toBeGreaterThan(20);
    expect(hue).toBeLessThan(35);
    expect(saturation).toBeGreaterThan(70);
  });

  it("is not thrown off by black, white, and grey around the color", () => {
    const tealOnGrey = pixels(
      [[0, 0, 0], 40],
      [[255, 255, 255], 20],
      [[128, 128, 128], 20],
      [[0, 170, 160], 20],
    );

    const { hue } = dominantColor(tealOnGrey);

    expect(hue).toBeGreaterThan(165);
    expect(hue).toBeLessThan(185);
  });

  it("joins a color spread either side of red, where the hue wraps round", () => {
    const reds = pixels([[220, 30, 60], 50], [[220, 60, 30], 50]);

    const { hue } = dominantColor(reds);

    expect(hue >= 350 || hue <= 10).toBe(true);
  });

  it("measures an image with almost no color as having none", () => {
    const blackAndWhite = pixels([[20, 20, 20], 60], [[235, 235, 235], 39], [[200, 40, 40], 1]);

    expect(dominantColor(blackAndWhite)).toEqual({ hue: 0, saturation: 0 });
  });
});

describe("measureArtwork", () => {
  it("measures nothing, and asks nobody, when providers are answered from recordings", async () => {
    expect(
      await measureArtwork("tmdb", "https://image.tmdb.org/t/p/w500/never-requested.jpg"),
    ).toBeNull();
  });
});

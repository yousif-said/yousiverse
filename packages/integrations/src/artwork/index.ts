import sharp from "sharp";
import { ProviderError, type ProviderName } from "../errors";
import { imageAt } from "../images";

export type ArtworkMeasure = {
  /** The dominant color's hue, 0 to 359 degrees. */
  hue: number;
  /** How vivid that color is, 0 to 100. A black-and-white image measures 0. */
  saturation: number;
  /** Width over height, times 1000. */
  aspect: number;
};

const TIMEOUT_MS = 2500;
const SAMPLE = 32;
const BINS = 36;
/** Pixels with less color than this are grey for our purposes and are not counted. */
const MIN_CHROMA = 0.08;
/** Below this share of colored pixels an image counts as having no color of its own. */
const MIN_COLORED_SHARE = 0.04;
/** How far, in degrees, a pixel's hue may be from the peak and still count toward it. */
const NEIGHBORHOOD = 25;

type Pixel = { hue: number; saturation: number; chroma: number };

function toPixel(red: number, green: number, blue: number): Pixel {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;
  if (chroma === 0) return { hue: 0, saturation: 0, chroma: 0 };
  const sixth =
    max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return {
    hue: (sixth * 60 + 360) % 360,
    saturation: chroma / (1 - Math.abs(2 * lightness - 1)),
    chroma,
  };
}

/** Degrees between two hues, the short way round the wheel. */
function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360;
  return distance > 180 ? 360 - distance : distance;
}

/** The color most of an image's colored area shares, from its raw RGB pixels. */
export function dominantColor(rgb: Uint8Array): { hue: number; saturation: number } {
  const pixels: Pixel[] = [];
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    pixels.push(toPixel(rgb[i] as number, rgb[i + 1] as number, rgb[i + 2] as number));
  }
  const colored = pixels.filter((pixel) => pixel.chroma >= MIN_CHROMA);
  if (colored.length < pixels.length * MIN_COLORED_SHARE) return { hue: 0, saturation: 0 };

  const bins = new Array<number>(BINS).fill(0);
  for (const pixel of colored) {
    const bin = Math.floor(pixel.hue / (360 / BINS)) % BINS;
    bins[bin] = (bins[bin] as number) + pixel.chroma;
  }
  // Neighboring bins count toward each other, so a color spread over two bins is not split.
  const smoothed = bins.map(
    (weight, bin) =>
      weight + ((bins[(bin + 1) % BINS] as number) + (bins[(bin + BINS - 1) % BINS] as number)) / 2,
  );
  const peak = (smoothed.indexOf(Math.max(...smoothed)) + 0.5) * (360 / BINS);

  let x = 0;
  let y = 0;
  let saturation = 0;
  let weight = 0;
  for (const pixel of colored) {
    if (hueDistance(pixel.hue, peak) > NEIGHBORHOOD) continue;
    const radians = (pixel.hue * Math.PI) / 180;
    x += Math.cos(radians) * pixel.chroma;
    y += Math.sin(radians) * pixel.chroma;
    saturation += pixel.saturation * pixel.chroma;
    weight += pixel.chroma;
  }
  if (weight === 0) return { hue: 0, saturation: 0 };
  return {
    hue: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) % 360,
    saturation: Math.round(Math.min(1, saturation / weight) * 100),
  };
}

/**
 * Reads a title's poster from its provider and measures its dominant color and its shape.
 * Null when provider calls are answered from recorded responses, which hold no images.
 */
export async function measureArtwork(
  provider: ProviderName,
  url: string,
): Promise<ArtworkMeasure | null> {
  if (process.env.PROVIDER_FIXTURES === "true") return null;
  const { pathname } = new URL(url);

  let response: Response;
  try {
    response = await fetch(imageAt(url, "small"), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    throw new ProviderError(provider, "unavailable", `request to ${pathname} failed`, { cause });
  }
  if (!response.ok) {
    const kind = response.status === 404 ? "not_found" : "unavailable";
    throw new ProviderError(provider, kind, `${pathname} responded ${response.status}`);
  }

  try {
    const image = sharp(Buffer.from(await response.arrayBuffer()));
    const { width, height } = await image.metadata();
    const pixels = await image
      .resize(SAMPLE, SAMPLE, { fit: "fill" })
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer();
    return { ...dominantColor(pixels), aspect: Math.round((width / height) * 1000) };
  } catch (cause) {
    throw new ProviderError(provider, "invalid_response", `${pathname} is not a readable image`, {
      cause,
    });
  }
}

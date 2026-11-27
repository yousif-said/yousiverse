import type { CSSProperties } from "react";
import type { MediaType } from "./media";

/** What it takes to draw a title anywhere: its artwork in its medium's shape, and its link. */
export type TitleArt = {
  type: MediaType;
  providerId: string;
  title: string;
  releaseYear?: number | null;
  posterUrl: string | null;
  backdropUrl?: string | null;
  /** The poster's dominant color, when it has been measured. */
  artHue?: number | null;
  artSaturation?: number | null;
  /** The poster's width over its height, times 1000. Only books vary. */
  posterAspect?: number | null;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const BOOK_RATIO = 0.66;

/** Width over height of a title's artwork: a poster, a screen, a case, or the book's own cover. */
export function ratioOf(title: Pick<TitleArt, "type" | "posterAspect">): number {
  switch (title.type) {
    case "movie":
      return 0.667;
    case "tv":
      return 1.778;
    case "game":
      return 0.75;
    case "book":
      return title.posterAspect ? clamp(title.posterAspect / 1000, 0.56, 0.8) : BOOK_RATIO;
  }
}

type Tone = Pick<TitleArt, "artHue" | "artSaturation">;

/**
 * Tints an element and everything in it with a title's color. Pair it with the `toned` class.
 * A title whose artwork has not been measured leaves the tint at the text color.
 */
export function toneStyle(title: Tone | null | undefined): CSSProperties {
  if (!title || title.artHue == null) return {};
  return {
    "--tone-h": title.artHue,
    "--tone-s": clamp(title.artSaturation ?? 0, 22, 78),
  } as CSSProperties;
}

/** The `toned` class, only for a title that has a color to give. */
export function tonedClass(title: Tone | null | undefined): string | undefined {
  return title && title.artHue != null ? "toned" : undefined;
}

/** The colored glow under a piece of artwork when it is hovered. */
export function glowStyle(title: Tone): CSSProperties {
  return {
    "--h": title.artHue ?? 40,
    "--s": title.artHue == null ? 0 : clamp(title.artSaturation ?? 0, 20, 80),
  } as CSSProperties;
}

/** The image behind a page for its ambient light: the backdrop when there is one. */
export function ambientOf(title: Pick<TitleArt, "posterUrl" | "backdropUrl">): string | null {
  return title.backdropUrl ?? title.posterUrl;
}

/**
 * The name shared by a title's artwork and the poster on its page, so one can grow into the
 * other. A show has none: its page opens on a wide picture, not a poster.
 */
export function morphName(title: Pick<TitleArt, "type" | "providerId">): string | undefined {
  if (title.type === "tv") return undefined;
  return `art-${title.type}-${title.providerId.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

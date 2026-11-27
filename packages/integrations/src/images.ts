/**
 * Provider image addresses carry their size, so one stored address can serve a thumbnail, a
 * card, and a full-width hero. Nothing here makes a request.
 */
export type ImageSize = "small" | "medium" | "large";

const TMDB = /^(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(\/.+)$/;
const IGDB = /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_)([a-z0-9_]+)(\/.+)$/;
const OPEN_LIBRARY = /^(https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-)[SML](\.jpg)$/;

// Small suits a thumbnail up to about 100px tall, medium a card, large the top of a page.
const TMDB_POSTER: Record<ImageSize, string> = { small: "w185", medium: "w342", large: "w500" };
const TMDB_WIDE: Record<ImageSize, string> = { small: "w300", medium: "w780", large: "w1280" };
const TMDB_WIDE_SIZES = new Set(["w300", "w780", "w1280", "original"]);
const IGDB_COVER: Record<ImageSize, string> = {
  small: "cover_big",
  medium: "cover_big",
  large: "cover_big_2x",
};
const IGDB_WIDE: Record<ImageSize, string> = {
  small: "screenshot_med",
  medium: "720p",
  large: "1080p",
};
const OPEN_LIBRARY_SIZE: Record<ImageSize, string> = { small: "M", medium: "L", large: "L" };

/**
 * The same image at another size. An address from somewhere else is returned as it is.
 * Episode stills are stored at a poster's width, so say `"wide"` when drawing one large.
 */
export function imageAt(url: string, size: ImageSize, shape?: "wide"): string {
  const tmdb = TMDB.exec(url);
  if (tmdb) {
    const wide = shape === "wide" || TMDB_WIDE_SIZES.has(tmdb[2] as string);
    const sizes = wide ? TMDB_WIDE : TMDB_POSTER;
    return `${tmdb[1]}${sizes[size]}${tmdb[3]}`;
  }
  const igdb = IGDB.exec(url);
  if (igdb) {
    const sizes = (igdb[2] as string).startsWith("cover") ? IGDB_COVER : IGDB_WIDE;
    return `${igdb[1]}${sizes[size]}${igdb[3]}`;
  }
  const openLibrary = OPEN_LIBRARY.exec(url);
  if (openLibrary) return `${openLibrary[1]}${OPEN_LIBRARY_SIZE[size]}${openLibrary[2]}`;
  return url;
}

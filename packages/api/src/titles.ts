import { media } from "@yousiverse/db/schema";

/**
 * What the app needs to draw a title on a card, a row, or a tile: its link, its artwork in its
 * medium's shape, and the artwork's color. Select these wherever a query returns titles.
 */
export const titleSummary = {
  mediaId: media.id,
  type: media.type,
  providerId: media.providerId,
  title: media.title,
  releaseYear: media.releaseYear,
  posterUrl: media.posterUrl,
  backdropUrl: media.backdropUrl,
  artHue: media.artHue,
  artSaturation: media.artSaturation,
  posterAspect: media.posterAspect,
};

/** Every title with a page has a provider id; this drops any that does not and narrows the type. */
export function withPages<Row extends { providerId: string | null }>(
  rows: Row[],
): (Row & { providerId: string })[] {
  return rows.flatMap((row) => (row.providerId ? { ...row, providerId: row.providerId } : []));
}

import type { CatalogRef } from "../catalog/import";

const TYPE_FOR_SEGMENT = { movies: "movie", tv: "tv", games: "game", books: "book" } as const;

/**
 * Reads which title a page address points at: "/movies/603", or the same with the site in front.
 * Returns null for anything that is not a title's page.
 */
export function parseTitleAddress(address: string): CatalogRef | null {
  const match = /(?:^|\/)(movies|tv|games|books)\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(address.trim());
  if (!match) return null;
  const type = TYPE_FOR_SEGMENT[match[1] as keyof typeof TYPE_FOR_SEGMENT];
  const providerId = match[2] ?? "";
  const valid = type === "book" ? /^OL\d{1,12}W$/ : /^\d{1,12}$/;
  return valid.test(providerId) ? { type, providerId } : null;
}

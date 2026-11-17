import type { MediaType } from "@yousiverse/db/schema";

/** The first part of each media type's page address: /movies/603, /tv/95396. */
export const PATH_SEGMENTS = {
  movie: "movies",
  tv: "tv",
  game: "games",
  book: "books",
} as const satisfies Record<MediaType, string>;

export function titlePath(type: MediaType, providerId: string): string {
  return `/${PATH_SEGMENTS[type]}/${encodeURIComponent(providerId)}`;
}

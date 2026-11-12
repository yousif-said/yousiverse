import type { RouterOutputs } from "@yousiverse/api";

export type MediaType = RouterOutputs["media"]["shelf"][number]["type"];

type MediaInfo = {
  /** Heading for a group of this type: "Movies". */
  label: string;
  /** One item, as a label: "TV show". */
  singular: string;
  /** Several items, mid-sentence: "TV shows". */
  plural: string;
  color: string;
  /** Colors a native form control, such as the rating slider. */
  accent: string;
  path: string;
};

export const MEDIA: Record<MediaType, MediaInfo> = {
  movie: {
    label: "Movies",
    singular: "Movie",
    plural: "movies",
    color: "bg-movie text-movie-foreground",
    accent: "accent-movie",
    path: "/movies",
  },
  tv: {
    label: "TV",
    singular: "TV show",
    plural: "TV shows",
    color: "bg-tv text-tv-foreground",
    accent: "accent-tv",
    path: "/tv",
  },
  game: {
    label: "Games",
    singular: "Game",
    plural: "games",
    color: "bg-game text-game-foreground",
    accent: "accent-game",
    path: "/games",
  },
  book: {
    label: "Books",
    singular: "Book",
    plural: "books",
    color: "bg-book text-book-foreground",
    accent: "accent-book",
    path: "/books",
  },
};

export const MEDIA_TYPES = Object.keys(MEDIA) as MediaType[];

export function isMediaType(value: unknown): value is MediaType {
  return MEDIA_TYPES.includes(value as MediaType);
}

export function mediaPath(type: MediaType, providerId: string): string {
  return `${MEDIA[type].path}/${encodeURIComponent(providerId)}`;
}

export function searchPath(query: string, type?: MediaType): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type) params.set("type", type);
  return params.size > 0 ? `/search?${params}` : "/search";
}

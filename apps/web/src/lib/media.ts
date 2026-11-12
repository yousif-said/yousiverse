import type { RouterOutputs } from "@yousiverse/api";

export type MediaType = RouterOutputs["media"]["shelf"][number]["type"];

export const MEDIA: Record<
  MediaType,
  { label: string; singular: string; color: string; path: string }
> = {
  movie: {
    label: "Movies",
    singular: "Movie",
    color: "bg-movie text-movie-foreground",
    path: "/movies",
  },
  tv: { label: "TV", singular: "TV show", color: "bg-tv text-tv-foreground", path: "/tv" },
  game: { label: "Games", singular: "Game", color: "bg-game text-game-foreground", path: "/games" },
  book: { label: "Books", singular: "Book", color: "bg-book text-book-foreground", path: "/books" },
};

export const MEDIA_TYPES = Object.keys(MEDIA) as MediaType[];

export function mediaPath(type: MediaType, providerId: string): string {
  return `${MEDIA[type].path}/${encodeURIComponent(providerId)}`;
}

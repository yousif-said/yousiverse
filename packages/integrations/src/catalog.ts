/** Shapes every catalog provider normalizes its data into. */

export type CatalogSearchResult = {
  type: "movie" | "tv" | "game" | "book";
  providerId: string;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  /** A wide image of the title. Only TMDB gives one with a search result. */
  backdropUrl: string | null;
  /** Who wrote it. Only books found by a search say. */
  authors?: string[];
};

export type CatalogItem = {
  providerId: string;
  title: string;
  overview: string | null;
  /** ISO date (YYYY-MM-DD). */
  releaseDate: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
};

export type CatalogMovie = CatalogItem & {
  tagline: string | null;
  runtimeMinutes: number | null;
};

export type CatalogGame = CatalogItem & {
  platforms: string[];
  developers: string[];
  publishers: string[];
  /** The game's id on Steam, when it is sold there. */
  steamAppId: string | null;
};

export type CatalogBook = CatalogItem & {
  authors: string[];
  pageCount: number | null;
};

export type CatalogEpisode = {
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
  stillUrl: string | null;
};

export type CatalogSeason = {
  seasonNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  posterUrl: string | null;
  episodes: CatalogEpisode[];
};

export type CatalogTvShow = CatalogItem & {
  tagline: string | null;
  status: string | null;
  seasons: CatalogSeason[];
};

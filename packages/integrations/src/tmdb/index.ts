import type { CatalogMovie, CatalogSearchResult, CatalogSeason, CatalogTvShow } from "../catalog";
import { env } from "../env";
import { requestJson } from "../http";
import { appendedSeasonsResponse, movieResponse, searchResponse, tvShowResponse } from "./schemas";

const API_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p";
// TMDB allows at most 20 appended sub-requests per call.
const SEASONS_PER_REQUEST = 20;

type ImageSize = "w342" | "w500" | "w1280";

function imageUrl(path: string | null | undefined, size: ImageSize): string | null {
  return path ? `${IMAGE_URL}/${size}${path}` : null;
}

function yearOf(date: string | null): number | null {
  return date ? Number(date.slice(0, 4)) : null;
}

function request<Schema extends Parameters<typeof requestJson>[2]>(
  path: string,
  schema: Schema,
  params: Record<string, string> = {},
) {
  const url = new URL(`${API_URL}${path}`);
  url.search = new URLSearchParams({ language: "en-US", ...params }).toString();

  // TMDB issues two credentials: a 32-character v3 key sent in the query, and a longer
  // read access token sent as a bearer token. Either works here.
  const isV3Key = /^[0-9a-f]{32}$/.test(env.TMDB_API_TOKEN);
  if (isV3Key) url.searchParams.set("api_key", env.TMDB_API_TOKEN);
  const headers = isV3Key ? undefined : { Authorization: `Bearer ${env.TMDB_API_TOKEN}` };

  return requestJson("tmdb", url, schema, { headers });
}

export async function search(query: string): Promise<CatalogSearchResult[]> {
  const { results } = await request("/search/multi", searchResponse, {
    query,
    include_adult: "false",
  });

  return results.flatMap((result) => {
    if (result.media_type !== "movie" && result.media_type !== "tv") return [];
    const isMovie = result.media_type === "movie";
    const title = isMovie ? result.title : result.name;
    if (!title) return [];
    return {
      type: result.media_type,
      providerId: String(result.id),
      title,
      releaseYear: yearOf(isMovie ? result.release_date : result.first_air_date),
      posterUrl: imageUrl(result.poster_path, "w342"),
    };
  });
}

export async function getMovie(providerId: string): Promise<CatalogMovie> {
  const movie = await request(`/movie/${encodeURIComponent(providerId)}`, movieResponse);

  return {
    providerId: String(movie.id),
    title: movie.title,
    overview: movie.overview,
    tagline: movie.tagline,
    releaseDate: movie.release_date,
    releaseYear: yearOf(movie.release_date),
    runtimeMinutes: movie.runtime || null,
    posterUrl: imageUrl(movie.poster_path, "w500"),
    backdropUrl: imageUrl(movie.backdrop_path, "w1280"),
    genres: movie.genres.map((genre) => genre.name),
  };
}

/** Fetches a show with every season and episode. */
export async function getTvShow(providerId: string): Promise<CatalogTvShow> {
  const path = `/tv/${encodeURIComponent(providerId)}`;
  const show = await request(path, tvShowResponse);

  const seasonNumbers = show.seasons.map((season) => season.season_number);
  const batches: number[][] = [];
  for (let start = 0; start < seasonNumbers.length; start += SEASONS_PER_REQUEST) {
    batches.push(seasonNumbers.slice(start, start + SEASONS_PER_REQUEST));
  }
  const appended = await Promise.all(
    batches.map((batch) =>
      request(path, appendedSeasonsResponse, {
        append_to_response: batch.map((number) => `season/${number}`).join(","),
      }),
    ),
  );
  const episodesBySeason = new Map(
    appended.flat().map((season) => [season.seasonNumber, season.episodes]),
  );

  const seasons: CatalogSeason[] = show.seasons.map((season) => ({
    seasonNumber: season.season_number,
    name: season.name,
    overview: season.overview,
    airDate: season.air_date,
    posterUrl: imageUrl(season.poster_path, "w342"),
    episodes: (episodesBySeason.get(season.season_number) ?? []).map((episode) => ({
      episodeNumber: episode.episode_number,
      name: episode.name ?? `Episode ${episode.episode_number}`,
      overview: episode.overview,
      airDate: episode.air_date,
      runtimeMinutes: episode.runtime || null,
      stillUrl: imageUrl(episode.still_path, "w500"),
    })),
  }));

  return {
    providerId: String(show.id),
    title: show.name,
    overview: show.overview,
    tagline: show.tagline,
    status: show.status,
    releaseDate: show.first_air_date,
    releaseYear: yearOf(show.first_air_date),
    posterUrl: imageUrl(show.poster_path, "w500"),
    backdropUrl: imageUrl(show.backdrop_path, "w1280"),
    genres: show.genres.map((genre) => genre.name),
    seasons,
  };
}

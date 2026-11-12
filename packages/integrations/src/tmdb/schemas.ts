import { z } from "zod";

// TMDB sends "" as often as null for missing text and dates.
const text = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || null);
const isoDate = text.transform((value) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null,
);
const imagePath = z.string().nullish();
const genres = z.array(z.object({ name: z.string() })).default([]);

export const searchResponse = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      // "person" results are dropped by the client.
      media_type: z.string(),
      title: text,
      name: text,
      release_date: isoDate,
      first_air_date: isoDate,
      poster_path: imagePath,
    }),
  ),
});

export const movieResponse = z.object({
  id: z.number(),
  title: z.string(),
  overview: text,
  tagline: text,
  release_date: isoDate,
  runtime: z.number().nullish(),
  poster_path: imagePath,
  backdrop_path: imagePath,
  genres,
});

const seasonSummary = z.object({
  season_number: z.number(),
  name: z.string(),
  overview: text,
  air_date: isoDate,
  poster_path: imagePath,
});

export const tvShowResponse = z.object({
  id: z.number(),
  name: z.string(),
  overview: text,
  tagline: text,
  status: text,
  first_air_date: isoDate,
  poster_path: imagePath,
  backdrop_path: imagePath,
  genres,
  seasons: z.array(seasonSummary).default([]),
});

const episode = z.object({
  episode_number: z.number(),
  name: text,
  overview: text,
  air_date: isoDate,
  runtime: z.number().nullish(),
  still_path: imagePath,
});

/** Seasons requested with `append_to_response=season/1,season/2` arrive under those keys. */
export const appendedSeasonsResponse = z.record(z.string(), z.unknown()).transform((response) =>
  Object.entries(response)
    .filter(([key]) => key.startsWith("season/"))
    .map(([key, value]) => ({
      seasonNumber: Number(key.slice("season/".length)),
      episodes: z.object({ episodes: z.array(episode).default([]) }).parse(value).episodes,
    })),
);

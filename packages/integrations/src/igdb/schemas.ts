import { z } from "zod";

const image = z.object({ image_id: z.string() });
const named = z.object({ name: z.string() });

export const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
});

export const searchResponse = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    first_release_date: z.number().optional(),
    cover: image.optional(),
  }),
);

export const gamesResponse = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    summary: z.string().optional(),
    first_release_date: z.number().optional(),
    cover: image.optional(),
    artworks: z.array(image).default([]),
    genres: z.array(named).default([]),
    platforms: z.array(named).default([]),
    involved_companies: z
      .array(z.object({ company: named, developer: z.boolean(), publisher: z.boolean() }))
      .default([]),
    // The same game's id on other sites. Source 1 is Steam.
    external_games: z
      .array(z.object({ uid: z.string().optional(), external_game_source: z.number().optional() }))
      .default([]),
  }),
);

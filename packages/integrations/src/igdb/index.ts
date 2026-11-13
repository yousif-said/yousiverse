import type { CatalogGame, CatalogSearchResult } from "../catalog";
import { env } from "../env";
import { ProviderError } from "../errors";
import { requestJson } from "../http";
import { gameQuery, searchQuery } from "./queries";
import { gamesResponse, searchResponse, tokenResponse } from "./schemas";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const GAMES_URL = "https://api.igdb.com/v4/games";
const IMAGE_URL = "https://images.igdb.com/igdb/image/upload";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const STEAM_SOURCE = 1;

type ImageSize = "cover_big" | "cover_big_2x" | "1080p";

function imageUrl(image: { image_id: string } | undefined, size: ImageSize): string | null {
  return image ? `${IMAGE_URL}/t_${size}/${image.image_id}.jpg` : null;
}

/** IGDB dates are Unix timestamps in seconds. */
function isoDate(timestamp: number | undefined): string | null {
  return timestamp === undefined ? null : new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function yearOf(date: string | null): number | null {
  return date ? Number(date.slice(0, 4)) : null;
}

// IGDB accepts a Twitch app token, which lasts about two months. Keep it for the life of the
// process instead of requesting one per call.
let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
    return cachedToken.value;
  }
  // Credentials go in the body, not the query string, so they never appear in a URL.
  const token = await requestJson("igdb", new URL(TOKEN_URL), tokenResponse, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.IGDB_CLIENT_ID,
      client_secret: env.IGDB_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return cachedToken.value;
}

async function queryGames<Schema extends Parameters<typeof requestJson>[2]>(
  query: string,
  schema: Schema,
) {
  return requestJson("igdb", new URL(GAMES_URL), schema, {
    method: "POST",
    body: query,
    headers: { "Client-ID": env.IGDB_CLIENT_ID, Authorization: `Bearer ${await accessToken()}` },
  });
}

export async function search(query: string): Promise<CatalogSearchResult[]> {
  const games = await queryGames(searchQuery(query), searchResponse);

  return games.map((game) => ({
    type: "game",
    providerId: String(game.id),
    title: game.name,
    releaseYear: yearOf(isoDate(game.first_release_date)),
    posterUrl: imageUrl(game.cover, "cover_big"),
  }));
}

export async function getGame(providerId: string): Promise<CatalogGame> {
  const [game] = await queryGames(gameQuery(providerId), gamesResponse);
  // IGDB answers an unknown id with an empty list rather than a 404.
  if (!game) throw new ProviderError("igdb", "not_found", `no game with id ${providerId}`);

  const releaseDate = isoDate(game.first_release_date);
  const companies = (role: "developer" | "publisher") =>
    game.involved_companies.filter((involved) => involved[role]).map(({ company }) => company.name);

  // A game can be on Steam more than once (demos, later editions). The original has the lowest id.
  const steamAppIds = game.external_games
    .filter((external) => external.external_game_source === STEAM_SOURCE)
    .flatMap((external) =>
      external.uid && /^\d+$/.test(external.uid) ? Number(external.uid) : [],
    );

  return {
    providerId: String(game.id),
    title: game.name,
    overview: game.summary?.trim() || null,
    releaseDate,
    releaseYear: yearOf(releaseDate),
    posterUrl: imageUrl(game.cover, "cover_big_2x"),
    backdropUrl: imageUrl(game.artworks[0], "1080p"),
    genres: game.genres.map((genre) => genre.name),
    platforms: game.platforms.map((platform) => platform.name),
    developers: companies("developer"),
    publishers: companies("publisher"),
    steamAppId: steamAppIds.length > 0 ? String(Math.min(...steamAppIds)) : null,
  };
}

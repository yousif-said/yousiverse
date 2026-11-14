import { z } from "zod";
import { env } from "../env";
import { requestJson } from "../http";

const API_URL = "https://api.steampowered.com";
/** Steam's own code for "there is such a profile" when looking up a custom profile name. */
const VANITY_FOUND = 1;
/** Steam answers 400, not 404, for an account id that does not exist. */
const NOT_FOUND_STATUSES = [400];

const vanityResponse = z.object({
  response: z.object({ success: z.number(), steamid: z.string().optional() }),
});

const ownedGamesResponse = z.object({
  response: z.object({
    // Left out entirely when the person keeps their game details private.
    games: z
      .array(
        z.object({
          appid: z.number(),
          name: z.string().optional(),
          playtime_forever: z.number().default(0),
        }),
      )
      .optional(),
  }),
});

function endpoint(path: string, params: Record<string, string>): URL {
  const url = new URL(`${API_URL}${path}`);
  url.search = new URLSearchParams({ ...params, key: env.STEAM_API_KEY }).toString();
  return url;
}

const STEAM_ID = /^7656119\d{10}$/;

/**
 * Works out a Steam account id from what a person pastes: a profile address
 * (steamcommunity.com/profiles/<id> or /id/<name>), a 17-digit id, or a custom profile name.
 * Returns null when no profile matches.
 */
export async function resolveSteamId(profile: string): Promise<string | null> {
  const text = profile.trim().replace(/\/+$/, "");
  const fromAddress = /steamcommunity\.com\/(profiles|id)\/([^/?#]+)/i.exec(text);
  const name = fromAddress ? (fromAddress[2] ?? "") : text;
  if (STEAM_ID.test(name)) return name;
  if (fromAddress?.[1]?.toLowerCase() === "profiles" || !/^[\w-]{2,64}$/.test(name)) return null;

  const { response } = await requestJson(
    "steam",
    endpoint("/ISteamUser/ResolveVanityURL/v1/", { vanityurl: name }),
    vanityResponse,
  );
  return response.success === VANITY_FOUND && response.steamid ? response.steamid : null;
}

export type OwnedGame = { appId: string; name: string; playtimeMinutes: number };

/**
 * The games an account owns. Returns null when Steam will not say, which means the person's
 * game details are private.
 */
export async function getOwnedGames(steamId: string): Promise<OwnedGame[] | null> {
  const { response } = await requestJson(
    "steam",
    endpoint("/IPlayerService/GetOwnedGames/v1/", {
      steamid: steamId,
      include_appinfo: "1",
      include_played_free_games: "1",
    }),
    ownedGamesResponse,
    undefined,
    { notFoundStatuses: NOT_FOUND_STATUSES },
  );
  if (!response.games) return null;
  return response.games.flatMap((game) =>
    game.name
      ? { appId: String(game.appid), name: game.name, playtimeMinutes: game.playtime_forever }
      : [],
  );
}

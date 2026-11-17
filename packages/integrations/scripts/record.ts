/**
 * Records real provider responses into src/fixtures for tests to replay.
 * Run `bun run --cwd packages/integrations record` after adding a request below. Name providers
 * to record only those (`record watchmode`), which leaves the other fixture files untouched.
 * Add `--missing` to keep every response already recorded and fetch only the new requests, so
 * existing tests do not shift when a provider's data has changed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fixtureKey } from "../src/fixtures/fixture-fetch";
import {
  gameQuery,
  gamesBySlugQuery,
  searchQuery,
  slugQuery,
  steamGamesQuery,
} from "../src/igdb/queries";
import { SEARCH_FIELDS, WORK_FIELDS } from "../src/open-library/fields";
import { relatedTitlesUrl, type WikidataTitle } from "../src/wikidata";

type Recording = { url: string; init?: RequestInit; headers?: Record<string, string> };

const tmdbToken = process.env.TMDB_API_TOKEN ?? "";
const tmdbUsesKey = /^[0-9a-f]{32}$/.test(tmdbToken);

function tmdb(path: string, params: Record<string, string> = {}): Recording {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.search = new URLSearchParams({ language: "en-US", ...params }).toString();
  if (tmdbUsesKey) url.searchParams.set("api_key", tmdbToken);
  return {
    url: url.href,
    headers: tmdbUsesKey ? undefined : { Authorization: `Bearer ${tmdbToken}` },
  };
}

const igdbClientId = process.env.IGDB_CLIENT_ID ?? "";
const igdbTokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: igdbClientId,
    client_secret: process.env.IGDB_CLIENT_SECRET ?? "",
    grant_type: "client_credentials",
  }),
});
const { access_token: igdbToken } = (await igdbTokenResponse.json()) as { access_token: string };

function igdb(body: string, endpoint = "games"): Recording {
  return {
    url: `https://api.igdb.com/v4/${endpoint}`,
    init: { method: "POST", body },
    headers: { "Client-ID": igdbClientId, Authorization: `Bearer ${igdbToken}` },
  };
}

function openLibrary(path: string, params: Record<string, string> = {}): Recording {
  const url = new URL(`https://openlibrary.org${path}`);
  url.search = new URLSearchParams(params).toString();
  return { url: url.href };
}

const openLibrarySearch = (query: string) =>
  openLibrary("/search.json", { q: query, fields: SEARCH_FIELDS, limit: "20" });
const openLibraryIsbn = (isbn: string) =>
  openLibrary("/search.json", { q: `isbn:${isbn}`, fields: SEARCH_FIELDS, limit: "1" });
const openLibraryTitle = (title: string, author?: string) =>
  openLibrary("/search.json", {
    title,
    ...(author ? { author } : {}),
    fields: SEARCH_FIELDS,
    limit: "5",
  });
const openLibraryWork = (workId: string) => [
  openLibrary(`/works/${workId}.json`),
  openLibrary("/search.json", { q: `key:/works/${workId}`, fields: WORK_FIELDS, limit: "1" }),
];

function watchmode(path: string, params: Record<string, string> = {}): Recording {
  const url = new URL(`https://api.watchmode.com/v1${path}`);
  url.search = new URLSearchParams({
    ...params,
    apiKey: process.env.WATCHMODE_API_KEY ?? "",
  }).toString();
  return { url: url.href };
}

const itadKey = process.env.ITAD_API_KEY ?? "";

function itadLookup(steamAppId: string): Recording {
  const url = new URL("https://api.isthereanydeal.com/games/lookup/v1");
  url.search = new URLSearchParams({ appid: steamAppId, key: itadKey }).toString();
  return { url: url.href };
}

function itadPrices(gameId: string): Recording {
  const url = new URL("https://api.isthereanydeal.com/games/prices/v3");
  url.search = new URLSearchParams({ country: "US", key: itadKey }).toString();
  return {
    url: url.href,
    init: { method: "POST", body: JSON.stringify([gameId]) },
    headers: { "Content-Type": "application/json" },
  };
}

function wikidata(title: WikidataTitle): Recording {
  return {
    url: relatedTitlesUrl(title).href,
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "Yousiverse/1.0 (https://yousiverse.com)",
    },
  };
}

// Responses that must not be recorded as they are, because the real ones contain credentials.
const steamApi = "GET api.steampowered.com";
const ownedGames = (steamId: string) =>
  `${steamApi}/IPlayerService/GetOwnedGames/v1/?include_appinfo=1&include_played_free_games=1&steamid=${steamId}`;

const traktTitle = (trakt: number, title: string, year: number, tmdb: number | null) => ({
  title,
  year,
  ids: { trakt, slug: `fixture-${trakt}`, imdb: null, tmdb },
});
const MATRIX = traktTitle(481, "The Matrix", 1999, 603);
const SEVERANCE = { ...traktTitle(154997, "Severance", 2022, 95396), aired_episodes: 19 };
const UNKNOWN_FILM = traktTitle(900001, "A Film Nobody Has", 2001, 999999999);
const NO_TMDB_ID = traktTitle(900002, "Only On Trakt", 2002, null);

/** One Trakt list for the test profile: its first page, then the empty page that ends it. */
function traktList(username: string, list: string, items: unknown[]) {
  const key = (page: number) =>
    `GET api.trakt.tv/users/${username}/${list}?extended=noseasons&limit=250&page=${page}`;
  return {
    [key(1)]: { status: 200, body: items },
    ...(items.length > 0 ? { [key(2)]: { status: 200, body: [] } } : {}),
  };
}

const handWritten: Record<string, Record<string, { status: number; body: unknown }>> = {
  // Trakt has no test account, and a real person's history should not be recorded.
  trakt: {
    "GET api.trakt.tv/users/fixturewatcher": {
      status: 200,
      body: { username: "fixturewatcher", private: false, ids: { slug: "fixturewatcher" } },
    },
    "GET api.trakt.tv/users/privatewatcher": {
      status: 200,
      body: { username: "privatewatcher", private: true, ids: { slug: "privatewatcher" } },
    },
    "GET api.trakt.tv/users/nobody-has-this": { status: 404, body: "" },
    ...traktList("fixturewatcher", "watched/movies", [{ plays: 2, movie: MATRIX }]),
    ...traktList("fixturewatcher", "watched/shows", [{ plays: 5, show: SEVERANCE }]),
    ...traktList("fixturewatcher", "ratings/movies", [{ rating: 9, type: "movie", movie: MATRIX }]),
    ...traktList("fixturewatcher", "ratings/shows", []),
    ...traktList("fixturewatcher", "watchlist/movies", [
      { rank: 1, type: "movie", movie: UNKNOWN_FILM },
      { rank: 2, type: "movie", movie: NO_TMDB_ID },
    ]),
    ...traktList("fixturewatcher", "watchlist/shows", []),
  },
  // Steam has no public test account, and a real person's library should not be recorded.
  steam: {
    [`${steamApi}/ISteamUser/ResolveVanityURL/v1/?vanityurl=fixtureplayer`]: {
      status: 200,
      body: { response: { steamid: "76561198000000001", success: 1 } },
    },
    [`${steamApi}/ISteamUser/ResolveVanityURL/v1/?vanityurl=nobody-has-this`]: {
      status: 200,
      body: { response: { success: 42, message: "No match" } },
    },
    [ownedGames("76561198000000001")]: {
      status: 200,
      body: {
        response: {
          game_count: 3,
          games: [
            { appid: 1145360, name: "Hades", playtime_forever: 1234, img_icon_url: "" },
            { appid: 620, name: "Portal 2", playtime_forever: 0, img_icon_url: "" },
            { appid: 999999999, name: "Some Tool", playtime_forever: 5, img_icon_url: "" },
          ],
        },
      },
    },
    // A profile whose game details are private.
    [ownedGames("76561198000000002")]: { status: 200, body: { response: {} } },
    // An account id that does not exist.
    [ownedGames("76561198000000003")]: { status: 400, body: "Bad Request" },
  },
  igdb: {
    "POST id.twitch.tv/oauth2/token": {
      status: 200,
      body: { access_token: "fixture-token", expires_in: 5_000_000, token_type: "bearer" },
    },
  },
};

const MATRIX_GAME_SLUGS = [
  "enter-the-matrix",
  "the-matrix-awakens-an-unreal-engine-5-experience",
  "the-matrix-online",
  "the-matrix-path-of-neo",
];

const recordings: Record<string, Recording[]> = {
  tmdb: [
    tmdb("/search/multi", { query: "severance", include_adult: "false" }),
    tmdb("/search/multi", { query: "hades", include_adult: "false" }),
    tmdb("/search/multi", { query: "piranesi", include_adult: "false" }),
    tmdb("/search/multi", { query: "zzzzqqqqxxxx", include_adult: "false" }),
    tmdb("/movie/603"),
    tmdb("/movie/999999999"),
    // The Matrix Reloaded: the sequel Wikidata suggests for The Matrix.
    tmdb("/movie/604"),
    tmdb("/tv/95396"),
    tmdb("/tv/95396", { append_to_response: "season/0,season/1,season/2,season/3" }),
    tmdb("/search/movie", { query: "The Matrix", include_adult: "false", year: "1999" }),
    tmdb("/search/movie", { query: "the matrix", include_adult: "false" }),
    tmdb("/search/movie", { query: "Zzzzqqqqxxxx", include_adult: "false", year: "1999" }),
    tmdb("/find/tt0133093", { external_source: "imdb_id" }),
    tmdb("/find/tt11280740", { external_source: "imdb_id" }),
    tmdb("/find/tt99999999", { external_source: "imdb_id" }),
  ],
  igdb: [
    igdb(searchQuery("hades")),
    igdb(searchQuery("severance")),
    igdb(searchQuery("piranesi")),
    igdb(searchQuery("zzzzqqqqxxxx")),
    igdb(gameQuery("113112")),
    igdb(gameQuery("999999999")),
    // Hades, Portal 2, and an id no game has: the Steam library used in tests.
    igdb(steamGamesQuery(["1145360", "620", "999999999"]), "external_games"),
    igdb(slugQuery("113112")),
    igdb(slugQuery("999999999")),
    igdb(gamesBySlugQuery(["hades-ii"])),
    // The games in The Matrix's franchise, as the recorded Wikidata answer lists them.
    igdb(gamesBySlugQuery(MATRIX_GAME_SLUGS)),
  ],
  "open-library": [
    openLibrarySearch("piranesi"),
    openLibrarySearch("hades"),
    openLibrarySearch("severance"),
    openLibrarySearch("zzzzqqqqxxxx"),
    ...openLibraryWork("OL20893680W"),
    // A work that was merged into another: it answers with a redirect record.
    ...openLibraryWork("OL893415W"),
    ...openLibraryWork("OL893414W"),
    ...openLibraryWork("OL99999999999W"),
    openLibraryIsbn("9781635575637"),
    openLibraryIsbn("9780000000002"),
    openLibraryTitle("Piranesi", "Susanna Clarke"),
    openLibraryTitle("Dune", "Frank Herbert"),
    openLibraryTitle("Zzzzqqqqxxxx", "Nobody"),
    openLibraryTitle("Zzzzqqqqxxxx"),
  ],
  steam: [],
  trakt: [],
  itad: [
    // Hades, by its Steam id, then by the id IsThereAnyDeal answers with.
    itadLookup("1145360"),
    itadPrices("018d937f-33f0-7200-80fc-87f769196c84"),
    itadLookup("999999999"),
  ],
  wikidata: [
    wikidata({ type: "movie", providerId: "603" }),
    wikidata({ type: "tv", providerId: "95396" }),
    wikidata({ type: "book", providerId: "OL20893680W" }),
    wikidata({ type: "game", providerId: "113112", igdbSlug: "hades--1" }),
    wikidata({ type: "movie", providerId: "999999999" }),
  ],
  watchmode: [
    watchmode("/title/movie-603/sources/", { regions: "US" }),
    watchmode("/title/tv-95396/sources/", { regions: "US" }),
    watchmode("/title/tv-1396/sources/", { regions: "US" }),
    watchmode("/title/movie-999999999/sources/", { regions: "US" }),
    watchmode("/title/movie-604/sources/", { regions: "US" }),
    watchmode("/sources/", { regions: "US" }),
  ],
};

// Bulky fields no client reads; dropping them keeps the fixture files reviewable.
const OMITTED_KEYS = new Set([
  "crew",
  "guest_stars",
  "assets",
  // From Watchmode's list of services.
  "regions",
  "logo_100px",
  "ios_appstore_url",
  "android_playstore_url",
  "android_scheme",
  "ios_scheme",
  "host_source",
  "host_source_id",
]);
// IsThereAnyDeal tags its store links with the id of the app that asked for them.
const withoutAppId = (text: string) => text.replace(/([?&]app=)\w+/, "$1fixture");
const forFixture = (_key: string, value: unknown) => {
  if (typeof value === "string") return withoutAppId(value);
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !OMITTED_KEYS.has(key)))
    : value;
};

const onlyMissing = process.argv.includes("--missing");
const onlyProviders = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const unknownProviders = onlyProviders.filter((provider) => !(provider in recordings));
if (unknownProviders.length > 0) {
  throw new Error(`No recordings for: ${unknownProviders.join(", ")}`);
}

for (const [provider, requests] of Object.entries(recordings)) {
  if (onlyProviders.length > 0 && !onlyProviders.includes(provider)) continue;
  const file = new URL(`../src/fixtures/${provider}.json`, import.meta.url);
  const recorded: Record<string, { status: number; body: unknown }> = onlyMissing
    ? JSON.parse(await readFile(file, "utf8"))
    : {};
  const fixtures = { ...recorded, ...handWritten[provider] };
  for (const { url, init, headers } of requests) {
    const key = fixtureKey(new URL(url), init);
    if (key in fixtures) continue;
    const response = await fetch(url, { ...init, headers: { ...init?.headers, ...headers } });
    fixtures[key] = { status: response.status, body: await response.json() };
    console.info(response.status, key);
  }
  await writeFile(file, `${JSON.stringify(fixtures, forFixture, 2)}\n`);
}

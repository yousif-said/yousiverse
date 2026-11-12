/**
 * Records real provider responses into src/fixtures for tests to replay.
 * Run `bun run --cwd packages/integrations record` after adding a request below.
 */
import { writeFile } from "node:fs/promises";
import { fixtureKey } from "../src/fixtures/fixture-fetch";
import { gameQuery, searchQuery } from "../src/igdb/queries";
import { SEARCH_FIELDS, WORK_FIELDS } from "../src/open-library/fields";

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

function igdb(body: string): Recording {
  return {
    url: "https://api.igdb.com/v4/games",
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
const openLibraryWork = (workId: string) => [
  openLibrary(`/works/${workId}.json`),
  openLibrary("/search.json", { q: `key:/works/${workId}`, fields: WORK_FIELDS, limit: "1" }),
];

// Responses that must not be recorded as they are, because the real ones contain credentials.
const handWritten: Record<string, Record<string, { status: number; body: unknown }>> = {
  igdb: {
    "POST id.twitch.tv/oauth2/token": {
      status: 200,
      body: { access_token: "fixture-token", expires_in: 5_000_000, token_type: "bearer" },
    },
  },
};

const recordings: Record<string, Recording[]> = {
  tmdb: [
    tmdb("/search/multi", { query: "severance", include_adult: "false" }),
    tmdb("/search/multi", { query: "hades", include_adult: "false" }),
    tmdb("/search/multi", { query: "piranesi", include_adult: "false" }),
    tmdb("/search/multi", { query: "zzzzqqqqxxxx", include_adult: "false" }),
    tmdb("/movie/603"),
    tmdb("/movie/999999999"),
    tmdb("/tv/95396"),
    tmdb("/tv/95396", { append_to_response: "season/0,season/1,season/2,season/3" }),
  ],
  igdb: [
    igdb(searchQuery("hades")),
    igdb(searchQuery("severance")),
    igdb(searchQuery("piranesi")),
    igdb(searchQuery("zzzzqqqqxxxx")),
    igdb(gameQuery("113112")),
    igdb(gameQuery("999999999")),
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
  ],
};

// Bulky fields no client reads; dropping them keeps the fixture files reviewable.
const OMITTED_KEYS = new Set(["crew", "guest_stars"]);
const withoutOmittedKeys = (_key: string, value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !OMITTED_KEYS.has(key)))
    : value;

for (const [provider, requests] of Object.entries(recordings)) {
  const fixtures: Record<string, { status: number; body: unknown }> = { ...handWritten[provider] };
  for (const { url, init, headers } of requests) {
    const response = await fetch(url, { ...init, headers: { ...init?.headers, ...headers } });
    const key = fixtureKey(new URL(url), init);
    fixtures[key] = { status: response.status, body: await response.json() };
    console.info(response.status, key);
  }
  const file = new URL(`../src/fixtures/${provider}.json`, import.meta.url);
  await writeFile(file, `${JSON.stringify(fixtures, withoutOmittedKeys, 2)}\n`);
}

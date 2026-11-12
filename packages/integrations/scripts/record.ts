/**
 * Records real provider responses into src/fixtures for tests to replay.
 * Run `bun run --cwd packages/integrations record` after adding a request below.
 */
import { writeFile } from "node:fs/promises";
import { fixtureKey } from "../src/fixtures/fixture-fetch";

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

const recordings: Record<string, Recording[]> = {
  tmdb: [
    tmdb("/search/multi", { query: "severance", include_adult: "false" }),
    tmdb("/search/multi", { query: "zzzzqqqqxxxx", include_adult: "false" }),
    tmdb("/movie/603"),
    tmdb("/movie/999999999"),
    tmdb("/tv/95396"),
    tmdb("/tv/95396", { append_to_response: "season/0,season/1,season/2,season/3" }),
  ],
};

// Bulky fields no client reads; dropping them keeps the fixture files reviewable.
const OMITTED_KEYS = new Set(["crew", "guest_stars"]);
const withoutOmittedKeys = (_key: string, value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !OMITTED_KEYS.has(key)))
    : value;

for (const [provider, requests] of Object.entries(recordings)) {
  const fixtures: Record<string, { status: number; body: unknown }> = {};
  for (const { url, init, headers } of requests) {
    const response = await fetch(url, { ...init, headers: { ...init?.headers, ...headers } });
    const key = fixtureKey(new URL(url), init);
    fixtures[key] = { status: response.status, body: await response.json() };
    console.info(response.status, key);
  }
  const file = new URL(`../src/fixtures/${provider}.json`, import.meta.url);
  await writeFile(file, `${JSON.stringify(fixtures, withoutOmittedKeys, 2)}\n`);
}

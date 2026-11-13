import igdb from "./igdb.json" with { type: "json" };
import openLibrary from "./open-library.json" with { type: "json" };
import tmdb from "./tmdb.json" with { type: "json" };
import watchmode from "./watchmode.json" with { type: "json" };

type Fixture = { status: number; body: unknown };

const fixtures: Record<string, Fixture> = { ...tmdb, ...igdb, ...openLibrary, ...watchmode };

const CREDENTIAL_PARAMS = ["api_key", "apiKey"];

/** Identifies a request by method, host, path, and sorted query, leaving credentials out. */
export function fixtureKey(url: URL, init?: RequestInit): string {
  const params = new URLSearchParams(url.search);
  for (const name of CREDENTIAL_PARAMS) params.delete(name);
  params.sort();
  const query = params.size > 0 ? `?${params}` : "";
  const body = typeof init?.body === "string" ? ` ${init.body}` : "";
  return `${init?.method ?? "GET"} ${url.host}${url.pathname}${query}${body}`;
}

/** Stands in for `fetch` in tests: answers from recorded responses and never uses the network. */
export const fixtureFetch: typeof fetch = async (input, init) => {
  const key = fixtureKey(new URL(input instanceof Request ? input.url : input), init);
  const fixture = fixtures[key];
  if (!fixture) {
    throw new Error(`No recorded response for "${key}". Add it to scripts/record.ts.`);
  }
  return Response.json(fixture.body, { status: fixture.status });
};

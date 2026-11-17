import igdb from "./igdb.json" with { type: "json" };
import itad from "./itad.json" with { type: "json" };
import openLibrary from "./open-library.json" with { type: "json" };
import resend from "./resend.json" with { type: "json" };
import steam from "./steam.json" with { type: "json" };
import tmdb from "./tmdb.json" with { type: "json" };
import trakt from "./trakt.json" with { type: "json" };
import watchmode from "./watchmode.json" with { type: "json" };
import wikidata from "./wikidata.json" with { type: "json" };

type Fixture = { status: number; body: unknown };

const fixtures: Record<string, Fixture> = {
  ...igdb,
  ...itad,
  ...openLibrary,
  ...resend,
  ...steam,
  ...tmdb,
  ...trakt,
  ...watchmode,
  ...wikidata,
};

const CREDENTIAL_PARAMS = ["api_key", "apiKey", "key"];
// Hosts answered the same whatever is sent: every email gets the one recorded "sent" response.
const BODY_IGNORED_HOSTS = new Set(["api.resend.com"]);

/** Identifies a request by method, host, path, and sorted query, leaving credentials out. */
export function fixtureKey(url: URL, init?: RequestInit): string {
  const params = new URLSearchParams(url.search);
  for (const name of CREDENTIAL_PARAMS) params.delete(name);
  params.sort();
  const query = params.size > 0 ? `?${params}` : "";
  const hasBody = typeof init?.body === "string" && !BODY_IGNORED_HOSTS.has(url.host);
  const body = hasBody ? ` ${init?.body}` : "";
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

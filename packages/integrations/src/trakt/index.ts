import { z } from "zod";
import { env } from "../env";
import { requestJson } from "../http";

const API_URL = "https://api.trakt.tv";
/** Trakt serves at most this many items a page, whatever is asked for. */
const PAGE_SIZE = 250;
/** A stop for a list that never ends, far above any real person's history. */
const MAX_PAGES = 60;

const title = z.object({
  title: z.string().nullish(),
  year: z.number().nullish(),
  aired_episodes: z.number().optional(),
  ids: z.object({
    trakt: z.number(),
    tmdb: z.number().nullish(),
    imdb: z.string().nullish(),
  }),
});

/** Every list names its titles under `movie` or `show`; the other fields vary by list. */
const listItem = z.object({
  movie: title.optional(),
  show: title.optional(),
  plays: z.number().optional(),
  rating: z.number().optional(),
});
const listResponse = z.array(listItem);

const profileResponse = z.object({ username: z.string(), private: z.boolean().default(false) });

function request<Schema extends Parameters<typeof requestJson>[2]>(
  path: string,
  schema: Schema,
  params: Record<string, string> = {},
) {
  const url = new URL(`${API_URL}${path}`);
  url.search = new URLSearchParams(params).toString();
  return requestJson("trakt", url, schema, {
    headers: {
      "Content-Type": "application/json",
      // Trakt requires every client to name itself.
      "User-Agent": "Yousiverse/1.0",
      "trakt-api-key": env.TRAKT_CLIENT_ID,
      "trakt-api-version": "2",
    },
  });
}

/** "https://trakt.tv/users/sean" or "sean" → "sean". Null for text that cannot be a username. */
export function traktUsername(profile: string): string | null {
  const text = profile.trim().replace(/\/+$/, "");
  const fromAddress = /trakt\.tv\/users\/([^/?#]+)/i.exec(text);
  const name = fromAddress ? (fromAddress[1] ?? "") : text.replace(/^@/, "");
  return /^[\w.-]{1,60}$/.test(name) ? name.toLowerCase() : null;
}

/** Whether a Trakt profile is private. Throws a not-found ProviderError for an unknown username. */
export async function getTraktProfile(username: string): Promise<{ private: boolean }> {
  const profile = await request(`/users/${encodeURIComponent(username)}`, profileResponse);
  return { private: profile.private };
}

export type TraktTitle = {
  type: "movie" | "tv";
  /** Trakt's own id, for telling titles apart across lists. */
  traktId: number;
  title: string;
  year: number | null;
  tmdbId: string | null;
  imdbId: string | null;
  /** How many times the person played it, when the list is their watch history. */
  plays: number | null;
  /** A show's episodes aired so far, to compare with `plays`. */
  airedEpisodes: number | null;
  /** 1 to 10, when the list is their ratings. */
  rating: number | null;
};

async function readList(username: string, list: string): Promise<TraktTitle[]> {
  const titles: TraktTitle[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const items = await request(`/users/${encodeURIComponent(username)}/${list}`, listResponse, {
      page: String(page),
      limit: String(PAGE_SIZE),
      // Leaves each show's seasons out of the watch history, which would be most of the response.
      extended: "noseasons",
    });
    if (items.length === 0) break;

    for (const item of items) {
      const [type, found] = item.movie
        ? (["movie", item.movie] as const)
        : (["tv", item.show] as const);
      if (!found?.title) continue;
      titles.push({
        type,
        traktId: found.ids.trakt,
        title: found.title,
        year: found.year ?? null,
        tmdbId: found.ids.tmdb ? String(found.ids.tmdb) : null,
        imdbId: found.ids.imdb ?? null,
        plays: item.plays ?? null,
        airedEpisodes: found.aired_episodes ?? null,
        rating: item.rating ?? null,
      });
    }
  }
  return titles;
}

/** A public Trakt profile's movies and shows: what was watched, rated, and put on the watchlist. */
export async function getTraktHistory(username: string) {
  // One list after another: Trakt limits how fast a client may ask.
  const watched = [
    ...(await readList(username, "watched/movies")),
    ...(await readList(username, "watched/shows")),
  ];
  const rated = [
    ...(await readList(username, "ratings/movies")),
    ...(await readList(username, "ratings/shows")),
  ];
  const watchlist = [
    ...(await readList(username, "watchlist/movies")),
    ...(await readList(username, "watchlist/shows")),
  ];
  return { watched, rated, watchlist };
}

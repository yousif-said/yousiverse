import type { CatalogBook, CatalogSearchResult } from "../catalog";
import { ProviderError } from "../errors";
import { requestJson } from "../http";
import { SEARCH_FIELDS, WORK_FIELDS } from "./fields";
import { searchResponse, workResponse } from "./schemas";
import { plainDescription, readableSubjects } from "./text";

const API_URL = "https://openlibrary.org";
const COVER_URL = "https://covers.openlibrary.org/b/id";
const WORK_ID = /^OL\d+W$/;

type CoverSize = "M" | "L";

function coverUrl(coverId: number | null | undefined, size: CoverSize): string | null {
  return coverId && coverId > 0 ? `${COVER_URL}/${coverId}-${size}.jpg` : null;
}

/** "/works/OL123W" → "OL123W" */
function workIdOf(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

function request<Schema extends Parameters<typeof requestJson>[2]>(
  path: string,
  schema: Schema,
  params: Record<string, string> = {},
) {
  const url = new URL(`${API_URL}${path}`);
  url.search = new URLSearchParams(params).toString();
  return requestJson("open_library", url, schema);
}

export async function search(query: string): Promise<CatalogSearchResult[]> {
  const { docs } = await request("/search.json", searchResponse, {
    q: query,
    fields: SEARCH_FIELDS,
    limit: "20",
  });

  return docs.map((doc) => ({
    type: "book",
    providerId: workIdOf(doc.key),
    title: doc.title,
    releaseYear: doc.first_publish_year ?? null,
    posterUrl: coverUrl(doc.cover_i, "M"),
  }));
}

/**
 * Fetches a work. Open Library merges duplicate works, so the returned `providerId` can differ
 * from the one asked for; callers should treat the returned id as the real one.
 */
export async function getBook(providerId: string): Promise<CatalogBook> {
  if (!WORK_ID.test(providerId)) {
    throw new ProviderError("open_library", "not_found", `not a work id: ${providerId}`);
  }

  // The work record has the description; authors, year, and page count are only in the search index.
  const [work, index] = await Promise.all([
    request(`/works/${providerId}.json`, workResponse),
    request("/search.json", searchResponse, {
      q: `key:/works/${providerId}`,
      fields: WORK_FIELDS,
      limit: "1",
    }),
  ]);
  if (work.location) return getBook(workIdOf(work.location));

  const indexed = index.docs[0];
  const title = work.title ?? indexed?.title;
  if (!title) throw new ProviderError("open_library", "invalid_response", "work has no title");

  return {
    providerId: workIdOf(work.key),
    title,
    overview: plainDescription(work.description),
    // Open Library knows the year a work was first published, not the day.
    releaseDate: null,
    releaseYear: indexed?.first_publish_year ?? null,
    posterUrl: coverUrl(work.covers[0] ?? indexed?.cover_i, "L"),
    backdropUrl: null,
    genres: readableSubjects(work.subjects),
    authors: indexed?.author_name ?? [],
    pageCount: indexed?.number_of_pages_median ?? null,
  };
}

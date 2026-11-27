import type { CatalogBook, CatalogSearchResult } from "../catalog";
import { ProviderError } from "../errors";
import { requestJson } from "../http";
import { AUTHOR_FIELDS, SEARCH_FIELDS, WORK_FIELDS } from "./fields";
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
    backdropUrl: null,
    authors: doc.author_name,
  }));
}

// A book with more credited authors than this is an anthology, not the author's own work.
const MAX_AUTHORS_FOR_OWN_WORK = 3;

/**
 * An author's books that have an English edition, the most widely published first. Open Library
 * has no "similar books", so this is what stands in for it. Works whose language is not recorded
 * are left out: most are single foreign editions listed apart from the book they translate.
 */
export async function getByAuthor(author: string): Promise<CatalogSearchResult[]> {
  const name = author.trim();
  if (!name) return [];
  const { docs } = await request("/search.json", searchResponse, {
    author: name,
    fields: AUTHOR_FIELDS,
    sort: "editions",
    limit: "20",
  });

  return docs
    .filter(
      (doc) =>
        doc.language.includes("eng") &&
        doc.author_name.length <= MAX_AUTHORS_FOR_OWN_WORK &&
        doc.author_name.some((credited) => comparable(credited) === comparable(name)),
    )
    .map((doc) => ({
      type: "book" as const,
      providerId: workIdOf(doc.key),
      title: doc.title,
      releaseYear: doc.first_publish_year ?? null,
      posterUrl: coverUrl(doc.cover_i, "M"),
      backdropUrl: null,
    }));
}

/** Lowercase letters and digits only, so punctuation and capitals do not stop titles matching. */
function comparable(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const ISBN = /^(\d{9}[\dXx]|\d{13})$/;

/**
 * Finds the one book an ISBN, or failing that a title and author, names, for matching rows
 * imported from another service. Returns null rather than guess: an ISBN match must have a
 * title that agrees, and without one only a book with exactly that title counts.
 */
export async function findBook(book: {
  isbn: string | null;
  title: string;
  author: string | null;
}): Promise<CatalogSearchResult | null> {
  const toResult = (doc: {
    key: string;
    title: string;
    first_publish_year?: number;
    cover_i?: number;
  }) =>
    ({
      type: "book",
      providerId: workIdOf(doc.key),
      title: doc.title,
      releaseYear: doc.first_publish_year ?? null,
      posterUrl: coverUrl(doc.cover_i, "M"),
      backdropUrl: null,
    }) satisfies CatalogSearchResult;

  if (book.isbn && ISBN.test(book.isbn)) {
    const byIsbn = await request("/search.json", searchResponse, {
      q: `isbn:${book.isbn}`,
      fields: SEARCH_FIELDS,
      limit: "1",
    });
    // Open Library has some wrong ISBNs, so the titles must agree too. One containing the other
    // is enough: editions differ in subtitles.
    const [doc] = byIsbn.docs;
    if (doc) {
      const [found, wanted] = [comparable(doc.title), comparable(book.title)];
      if (found && wanted && (found.includes(wanted) || wanted.includes(found))) {
        return toResult(doc);
      }
    }
  }

  const byTitle = await request("/search.json", searchResponse, {
    title: book.title,
    ...(book.author ? { author: book.author } : {}),
    fields: SEARCH_FIELDS,
    limit: "5",
  });
  const exact = byTitle.docs.find((doc) => comparable(doc.title) === comparable(book.title));
  return exact ? toResult(exact) : null;
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

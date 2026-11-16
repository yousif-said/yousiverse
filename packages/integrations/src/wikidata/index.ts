import { z } from "zod";
import { requestJson } from "../http";

const SPARQL_URL = "https://query.wikidata.org/sparql";
// Wikimedia asks every client to say who it is and where it can be reached.
const USER_AGENT = "Yousiverse/1.0 (https://yousiverse.com)";
const ENTITY_PREFIX = "http://www.wikidata.org/entity/";
// The public query service is shared and can take a while to answer a query it has not seen.
const TIMEOUT_MS = 25_000;

/** Wikidata's properties holding each catalog provider's id for a work. */
const TMDB_MOVIE_ID = "P4947";
const TMDB_TV_ID = "P4983";
const IGDB_NUMERIC_ID = "P9043";
const IGDB_SLUG = "P5794";
const OPEN_LIBRARY_ID = "P648";

/** How another title relates to the one asked about, most specific first. */
export const wikidataRelations = [
  "based_on",
  "basis_for",
  "follows",
  "followed_by",
  "same_franchise",
] as const;
export type WikidataRelation = (typeof wikidataRelations)[number];

export type WikidataTitle = {
  type: "movie" | "tv" | "game" | "book";
  /** The title's id at its catalog provider. */
  providerId: string;
  /** For a game: the name IGDB uses in its own addresses, which Wikidata usually holds instead. */
  igdbSlug?: string | null;
};

export type RelatedTitle = {
  relation: WikidataRelation;
  title: string;
  type: WikidataTitle["type"];
  /** Null for a game that Wikidata knows only by its IGDB slug. */
  providerId: string | null;
  igdbSlug: string | null;
};

const value = z.object({ value: z.string() });
const sparqlResponse = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        relation: value,
        other: value,
        otherLabel: value.optional(),
        tmdbMovie: value.optional(),
        tmdbTv: value.optional(),
        igdb: value.optional(),
        igdbSlug: value.optional(),
        openLibrary: value.optional(),
      }),
    ),
  }),
});
type Binding = z.output<typeof sparqlResponse>["results"]["bindings"][number];

const NUMERIC_ID = /^\d{1,12}$/;
const OPEN_LIBRARY_WORK = /^OL\d{1,12}W$/;
const SLUG = /^[a-z0-9-]{1,200}$/;

/** The SPARQL pattern that finds the Wikidata item for a catalog title. */
function itemPattern({ type, providerId, igdbSlug }: WikidataTitle): string {
  const valid = type === "book" ? OPEN_LIBRARY_WORK : NUMERIC_ID;
  if (!valid.test(providerId)) throw new Error(`Not a ${type} id: ${providerId}`);
  switch (type) {
    case "movie":
      return `?item wdt:${TMDB_MOVIE_ID} "${providerId}" .`;
    case "tv":
      return `?item wdt:${TMDB_TV_ID} "${providerId}" .`;
    case "book":
      return `?item wdt:${OPEN_LIBRARY_ID} "${providerId}" .`;
    case "game": {
      const byId = `{ ?item wdt:${IGDB_NUMERIC_ID} "${providerId}" }`;
      if (!igdbSlug) return byId;
      if (!SLUG.test(igdbSlug)) throw new Error(`Not an IGDB slug: ${igdbSlug}`);
      return `${byId} UNION { ?item wdt:${IGDB_SLUG} "${igdbSlug}" }`;
    }
  }
}

const HAS_CATALOG_ID = `FILTER EXISTS { ?other wdt:${TMDB_MOVIE_ID}|wdt:${TMDB_TV_ID}|wdt:${IGDB_NUMERIC_ID}|wdt:${IGDB_SLUG}|wdt:${OPEN_LIBRARY_ID} [] }`;

/** Picks connected works, capped before anything is read about them so no query grows large. */
function connectedWorks(item: string, relations: string[], limit: number): string {
  return [
    "{ SELECT DISTINCT ?relation ?other WHERE {",
    item,
    relations.join(" UNION "),
    "FILTER(?other != ?item)",
    HAS_CATALOG_ID,
    `} LIMIT ${limit} }`,
  ].join("\n");
}

/**
 * Finds works connected to a title: what it is based on (P144), what follows it (P155, P156),
 * and what shares its series (P179) or franchise (P8345). Only works that carry a catalog
 * provider's id come back.
 */
export function relatedTitlesQuery(title: WikidataTitle): string {
  const item = itemPattern(title);
  const relation = (pattern: string, name: WikidataRelation) =>
    `{ ${pattern} BIND("${name}" AS ?relation) }`;
  const direct = [
    relation("?item wdt:P144 ?other .", "based_on"),
    relation("?other wdt:P144 ?item .", "basis_for"),
    relation("?item wdt:P155 ?other .", "follows"),
    relation("?other wdt:P156 ?item .", "follows"),
    relation("?item wdt:P156 ?other .", "followed_by"),
    relation("?other wdt:P155 ?item .", "followed_by"),
  ];
  const shared = [
    relation("?item wdt:P179 ?group . ?other wdt:P179 ?group .", "same_franchise"),
    relation("?item wdt:P8345 ?group . ?other wdt:P8345 ?group .", "same_franchise"),
  ];
  return [
    "SELECT ?relation ?other ?otherLabel ?tmdbMovie ?tmdbTv ?igdb ?igdbSlug ?openLibrary WHERE {",
    // Separate caps, so a franchise of hundreds cannot crowd out a title's own source or sequel.
    `${connectedWorks(item, direct, 100)} UNION ${connectedWorks(item, shared, 300)}`,
    `OPTIONAL { ?other wdt:${TMDB_MOVIE_ID} ?tmdbMovie }`,
    `OPTIONAL { ?other wdt:${TMDB_TV_ID} ?tmdbTv }`,
    `OPTIONAL { ?other wdt:${IGDB_NUMERIC_ID} ?igdb }`,
    `OPTIONAL { ?other wdt:${IGDB_SLUG} ?igdbSlug }`,
    `OPTIONAL { ?other wdt:${OPEN_LIBRARY_ID} ?openLibrary }`,
    // Many works now have only a language-neutral ("mul") name.
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }',
    "}",
  ].join("\n");
}

export function relatedTitlesUrl(title: WikidataTitle): URL {
  const url = new URL(SPARQL_URL);
  url.search = new URLSearchParams({ format: "json", query: relatedTitlesQuery(title) }).toString();
  return url;
}

/** Which catalog entry a Wikidata work is. Null when its ids are of no use to the catalog. */
function catalogEntry(row: Binding): Pick<RelatedTitle, "type" | "providerId" | "igdbSlug"> | null {
  if (row.tmdbMovie && NUMERIC_ID.test(row.tmdbMovie.value)) {
    return { type: "movie", providerId: row.tmdbMovie.value, igdbSlug: null };
  }
  if (row.tmdbTv && NUMERIC_ID.test(row.tmdbTv.value)) {
    return { type: "tv", providerId: row.tmdbTv.value, igdbSlug: null };
  }
  const gameId = row.igdb && NUMERIC_ID.test(row.igdb.value) ? row.igdb.value : null;
  const slug = row.igdbSlug && SLUG.test(row.igdbSlug.value) ? row.igdbSlug.value : null;
  if (gameId || slug) return { type: "game", providerId: gameId, igdbSlug: slug };
  // Open Library ids also name editions and authors; only works are catalog entries.
  if (row.openLibrary && OPEN_LIBRARY_WORK.test(row.openLibrary.value)) {
    return { type: "book", providerId: row.openLibrary.value, igdbSlug: null };
  }
  return null;
}

/**
 * Lists the works Wikidata connects to a title, each once, under its most specific relation.
 * These are suggestions for a person to review, not facts to show.
 */
export async function getRelatedTitles(title: WikidataTitle): Promise<RelatedTitle[]> {
  const { results } = await requestJson(
    "wikidata",
    relatedTitlesUrl(title),
    sparqlResponse,
    { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } },
    { timeoutMs: TIMEOUT_MS },
  );

  const byWork = new Map<string, RelatedTitle>();
  for (const row of results.bindings) {
    const relation = wikidataRelations.find((name) => name === row.relation.value);
    const name = row.otherLabel?.value;
    const entry = catalogEntry(row);
    // A work with no name comes back labelled with its own Wikidata id.
    if (!relation || !entry || !name || name === row.other.value.replace(ENTITY_PREFIX, "")) {
      continue;
    }
    const known = byWork.get(row.other.value);
    if (known && wikidataRelations.indexOf(known.relation) <= wikidataRelations.indexOf(relation)) {
      continue;
    }
    byWork.set(row.other.value, { relation, title: name, ...entry });
  }
  return [...byWork.values()].sort(
    (a, b) =>
      wikidataRelations.indexOf(a.relation) - wikidataRelations.indexOf(b.relation) ||
      a.title.localeCompare(b.title),
  );
}

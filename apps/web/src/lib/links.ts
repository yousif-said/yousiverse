import type { RouterOutputs } from "@yousiverse/api";
import type { LibraryStatus } from "./library";
import type { MediaType } from "./media";

export type LinkSuggestion = RouterOutputs["links"]["suggestions"]["pending"][number];
export type LinkKind = LinkSuggestion["kind"];

export type Universe = RouterOutputs["links"]["universe"];
export type UniverseSummary = RouterOutputs["links"]["universes"][number];
export type UniverseTitle = Universe["titles"][number];
export type UniverseLink = Universe["links"][number];

/** What a link says about its first title, ready for the second title to follow. */
export const LINK_PHRASES: Record<LinkKind, string> = {
  adaptation_of: "is based on",
  sequel_of: "is a sequel to",
  same_franchise: "is in the same franchise as",
};

export const LINK_KINDS = Object.keys(LINK_PHRASES) as LinkKind[];

export function isLinkKind(value: unknown): value is LinkKind {
  return LINK_KINDS.includes(value as LinkKind);
}

/**
 * Puts a suggestion's two titles in the order its sentence reads: a reversed suggestion is
 * about the other title ("the other title is a sequel to this one").
 */
export function suggestionSides<Title, Target>(suggestion: {
  reversed: boolean;
  title: Title;
  target: Target;
}): [Title | Target, Title | Target] {
  return suggestion.reversed
    ? [suggestion.target, suggestion.title]
    : [suggestion.title, suggestion.target];
}

/** The address of a universe. Any one of its titles' media ids names it. */
export function universePath(id: string): string {
  return `/youniverses/${encodeURIComponent(id)}`;
}

/** A universe named in a heading or a sentence: "The Dune universe", "The Matrix universe". */
export function universeTitle(name: string): string {
  return /^the\s/i.test(name) ? `${name} universe` : `The ${name} universe`;
}

/** How one title of a universe stands to another, in the order a title's relations are listed. */
export const RELATIONS = [
  "Based on",
  "Adapted as",
  "Before this",
  "After this",
  "Same universe",
] as const;
export type Relation = (typeof RELATIONS)[number];

type Link = Pick<UniverseLink, "fromMediaId" | "toMediaId" | "kind">;

/**
 * What the title `other` is to the title `here`: what it is based on, what it was adapted as,
 * what came before or after it. Titles of one franchise, and titles joined only by way of
 * others, are simply in the same universe.
 */
export function relationTo(links: Link[], here: string, other: string): Relation {
  for (const { fromMediaId, toMediaId, kind } of links) {
    if (kind === "same_franchise") continue;
    // A link reads from the later title to the one it is based on or follows.
    if (fromMediaId === here && toMediaId === other) {
      return kind === "adaptation_of" ? "Based on" : "Before this";
    }
    if (fromMediaId === other && toMediaId === here) {
      return kind === "adaptation_of" ? "Adapted as" : "After this";
    }
  }
  return "Same universe";
}

/**
 * The titles a title is linked to directly, grouped by what they are to it. This is what the
 * lines of a universe's map show, in words.
 */
export function directRelations<Title extends { mediaId: string }>(
  links: Link[],
  titles: Title[],
  here: string,
): { relation: Relation; titles: Title[] }[] {
  const linked = new Set(
    links.flatMap(({ fromMediaId, toMediaId }) =>
      fromMediaId === here ? toMediaId : toMediaId === here ? fromMediaId : [],
    ),
  );
  const neighbors = titles.filter((title) => linked.has(title.mediaId));
  return RELATIONS.map((relation) => ({
    relation,
    titles: neighbors.filter((title) => relationTo(links, here, title.mediaId) === relation),
  })).filter((group) => group.titles.length > 0);
}

/** How far a person is through a universe, counted from their library. */
export function universeProgress(
  titles: { mediaId: string }[],
  status: Map<string, LibraryStatus>,
): { total: number; finished: number; started: number; wanted: number } {
  const count = (wanted: LibraryStatus) =>
    titles.filter((title) => status.get(title.mediaId) === wanted).length;
  return {
    total: titles.length,
    finished: count("finished"),
    started: count("in_progress"),
    wanted: count("want"),
  };
}

// Top to bottom, a story usually starts as a book and ends as a game.
const LANES: MediaType[] = ["book", "movie", "tv", "game"];

/**
 * The shape of a universe's map: a column for each release year in order, with one last column
 * (null) for titles that have no year yet, and a lane for each medium that occurs.
 */
export function mapLayout(titles: { type: MediaType; releaseYear: number | null }[]): {
  years: (number | null)[];
  lanes: MediaType[];
} {
  const years = [...new Set(titles.map((title) => title.releaseYear))].sort(
    (a, b) => (a ?? Infinity) - (b ?? Infinity),
  );
  return { years, lanes: LANES.filter((lane) => titles.some((title) => title.type === lane)) };
}

type Colored = { artSaturation: number | null; backdropUrl: string | null };

/** The title a universe's tile takes its color from: the first one that has much of it. */
export function tileLead<Title extends Colored>(titles: Title[]): Title | undefined {
  return titles.find((title) => (title.artSaturation ?? 0) > 30) ?? titles[0];
}

/** The title whose artwork lights a universe's page: a colorful backdrop, or any backdrop. */
export function pageLead<Title extends Colored>(titles: Title[]): Title | undefined {
  return (
    titles.find((title) => title.backdropUrl && (title.artSaturation ?? 0) > 40) ??
    titles.find((title) => title.backdropUrl) ??
    titles[0]
  );
}

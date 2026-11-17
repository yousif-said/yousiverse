import type { RouterOutputs } from "@yousiverse/api";

export type TitleLink = RouterOutputs["links"]["forTitle"][number];
export type TitleRelation = TitleLink["relation"];
export type LinkSuggestion = RouterOutputs["links"]["suggestions"]["pending"][number];
export type LinkKind = LinkSuggestion["kind"];

/** Headings for a title's linked titles, in the order its page shows them. */
export const RELATION_HEADINGS: Record<TitleRelation, string> = {
  based_on: "Based on",
  adapted_as: "Adaptations",
  sequel_to: "Follows",
  followed_by: "Followed by",
  same_franchise: "Same franchise",
};

export const TITLE_RELATIONS = Object.keys(RELATION_HEADINGS) as TitleRelation[];

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

// Relative paths, because the unit tests load this file and Vitest has no "@/" alias here.
import { type LinkKind, suggestionSides } from "../../lib/links";
import { MEDIA } from "../../lib/media";
import type { TitleArt } from "../../lib/titles";

/**
 * One end of a link. Only its name, medium, and page are certain: a suggestion's target may not
 * be in the catalog yet, so the artwork is drawn from whatever else is known.
 */
export type Side = Pick<TitleArt, "type" | "providerId" | "title"> &
  Partial<Omit<TitleArt, "type" | "providerId" | "title">>;

/** "The Matrix (movie, 1999)", for telling apart titles that share a name. */
export function sideLabel(side: Side): string {
  const kind = side.type === "tv" ? MEDIA.tv.singular : MEDIA[side.type].singular.toLowerCase();
  return `${side.title} (${kind}${side.releaseYear ? `, ${side.releaseYear}` : ""})`;
}

/** What the queue says between two titles, read from the original to what came of it. */
export const QUEUE_RELATIONS: Record<LinkKind, string> = {
  adaptation_of: "was adapted as",
  sequel_of: "is followed by",
  same_franchise: "shares a universe with",
};

/**
 * A suggestion's two titles in the order the queue reads them. A link is stored from the newer
 * work to its source ("is a sequel of"), and the queue shows the source first.
 */
export function queueOrder<Title extends Side, Target extends Side>(suggestion: {
  kind: LinkKind;
  reversed: boolean;
  title: Title;
  target: Target;
}): [Title | Target, Title | Target] {
  const [from, to] = suggestionSides(suggestion);
  return suggestion.kind === "same_franchise" ? [from, to] : [to, from];
}

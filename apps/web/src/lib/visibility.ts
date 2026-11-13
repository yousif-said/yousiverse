import type { LibraryEntry } from "./library";

export type Visibility = LibraryEntry["visibility"];

/** The choices for who can see something, most open first. */
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Everyone",
  friends: "Friends only",
  private: "Only me",
};

export const VISIBILITIES = Object.keys(VISIBILITY_LABELS) as Visibility[];

export function isVisibility(value: unknown): value is Visibility {
  return VISIBILITIES.includes(value as Visibility);
}

/** A note for the owner about something not everyone can see. Empty when everyone can. */
export function visibilityNote(visibility: Visibility, onlyYou = "only you"): string {
  if (visibility === "public") return "";
  return visibility === "friends" ? ", friends only" : `, ${onlyYou}`;
}

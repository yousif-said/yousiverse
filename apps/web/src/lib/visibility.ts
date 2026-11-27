import type { IconName } from "@/components/ui/icon";
import type { LibraryEntry } from "./library";

export type Visibility = LibraryEntry["visibility"];

/** Who can see something, most open first: one or two words and an icon for each choice. */
export const VISIBILITY: Record<Visibility, { label: string; icon: IconName }> = {
  public: { label: "Everyone", icon: "globe" },
  friends: { label: "Friends", icon: "clubs" },
  private: { label: "Only you", icon: "lock" },
};

export const VISIBILITIES = Object.keys(VISIBILITY) as Visibility[];

export function isVisibility(value: unknown): value is Visibility {
  return VISIBILITIES.includes(value as Visibility);
}

/** A note for the owner about something not everyone can see. Empty when everyone can. */
export function visibilityNote(visibility: Visibility, onlyYou = "only you"): string {
  if (visibility === "public") return "";
  return visibility === "friends" ? ", friends only" : `, ${onlyYou}`;
}

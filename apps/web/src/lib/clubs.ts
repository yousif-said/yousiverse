import type { RouterOutputs } from "@yousiverse/api";
import { MEDIA, type MediaType } from "./media";

export type Club = RouterOutputs["clubs"]["get"];
export type ClubAccess = Club["access"];

export const ACCESS_LABELS: Record<ClubAccess, { label: string; help: string }> = {
  public: { label: "Public", help: "Anyone can find the club and join." },
  invite_only: {
    label: "Invite only",
    help: "Only people with the invite link can see the club or join.",
  },
};

export const CLUB_ACCESS_LEVELS = Object.keys(ACCESS_LABELS) as ClubAccess[];

/** "Books", "Movies and TV", "Movies, TV, and games". */
export function coveredTypes(types: MediaType[]): string {
  const names = types.map((type, index) =>
    index === 0 || type === "tv" ? MEDIA[type].label : MEDIA[type].plural,
  );
  return new Intl.ListFormat("en-US", { type: "conjunction" }).format(names);
}

export function clubPath(id: string, invite?: string | null): string {
  return invite ? `/clubs/${id}?invite=${encodeURIComponent(invite)}` : `/clubs/${id}`;
}

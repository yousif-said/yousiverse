import type { RouterOutputs } from "@yousiverse/api";
import type { IconName } from "@/components/ui/icon";
import { MEDIA, type MediaType } from "./media";

export type Club = RouterOutputs["clubs"]["get"];
export type ClubAccess = Club["access"];

type AccessInfo = {
  /** What the club is: "Invite only". */
  label: string;
  /** The same thing as an answer to "Who can join": "Invite link only". */
  choice: string;
  icon: IconName;
};

export const ACCESS: Record<ClubAccess, AccessInfo> = {
  public: { label: "Public", choice: "Anyone", icon: "globe" },
  invite_only: { label: "Invite only", choice: "Invite link only", icon: "lock" },
};

export const CLUB_ACCESS_LEVELS = Object.keys(ACCESS) as ClubAccess[];

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

export function discussionPath(clubId: string, threadId: string): string {
  return `/clubs/${clubId}/discussions/${threadId}`;
}

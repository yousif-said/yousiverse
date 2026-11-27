import type { LibraryStatus } from "./library";
import type { MediaType } from "./media";

/** A person's public profile, optionally with its library filtered. */
export function profilePath(username: string, type?: MediaType, status?: LibraryStatus): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const path = `/u/${encodeURIComponent(username)}`;
  return params.size > 0 ? `${path}?${params}` : path;
}

/** The sections of a profile, in the order its tabs show them. */
export const PROFILE_TABS = ["library", "reviews", "lists", "following", "followers"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function isProfileTab(value: unknown): value is ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab);
}

/** One section of a person's profile. The library is the profile's own address. */
export function profileTabPath(username: string, tab: ProfileTab): string {
  return tab === "library" ? profilePath(username) : `${profilePath(username)}?tab=${tab}`;
}

/** An average rating, kept in quarter points, to one decimal out of ten: "8.3". */
export function averageLabel(quarterPoints: number | null): string {
  return quarterPoints === null ? "–" : (quarterPoints / 4).toFixed(1);
}

/**
 * A rating histogram in words, for people who cannot see its bars: "2 at 7, 5 at 8.5".
 * `histogram` counts ratings per half point, from 0 up to 10.
 */
export function histogramLabel(histogram: number[]): string {
  const bars = histogram.flatMap((count, halfPoints) =>
    count > 0 ? `${count} at ${halfPoints / 2}` : [],
  );
  return bars.length > 0 ? `Ratings from 0 to 10: ${bars.join(", ")}` : "No ratings yet";
}

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

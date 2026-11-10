/** Limits post-sign-in redirects to paths on this site, so `?next=` can't send people elsewhere. */
export function safeRedirectPath(path: string | undefined): string {
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

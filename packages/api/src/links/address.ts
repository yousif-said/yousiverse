import type { MediaType } from "@yousiverse/db/schema";
import type { CatalogRef } from "../catalog/import";
import { PATH_SEGMENTS } from "../catalog/paths";

const TYPE_FOR_SEGMENT = Object.fromEntries(
  Object.entries(PATH_SEGMENTS).map(([type, segment]) => [segment, type]),
) as Record<string, MediaType>;

/**
 * Reads which title a page address points at: "/movies/603", or the same with the site in front.
 * Returns null for anything that is not a title's page.
 */
export function parseTitleAddress(address: string): CatalogRef | null {
  const match = /(?:^|\/)(movies|tv|games|books)\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(address.trim());
  const type = TYPE_FOR_SEGMENT[match?.[1] ?? ""];
  const providerId = match?.[2] ?? "";
  if (!type) return null;
  const valid = type === "book" ? /^OL\d{1,12}W$/ : /^\d{1,12}$/;
  return valid.test(providerId) ? { type, providerId } : null;
}

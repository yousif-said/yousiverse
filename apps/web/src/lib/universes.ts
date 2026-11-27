// For Server Components only: this asks the API directly. A client component that needs a
// universe's address takes `universePath` from `@/lib/links`, which has everything else too.
import { getMarks, type Marks } from "@/lib/marks";
import { getQueryClient, trpc } from "@/trpc/server";

export { universePath } from "./links";

/** The universe a title belongs to, for linking to it, or null when it stands alone. */
export async function getUniverseOf(mediaId: string): Promise<{ id: string; name: string } | null> {
  return getQueryClient().fetchQuery(trpc.links.universeOf.queryOptions({ mediaId }));
}

// The API answers about this many titles in one request.
const TITLES_PER_REQUEST = 300;

/**
 * `getMarks` for any number of titles. The index shows every universe at once, which can be
 * more titles than one request may ask about.
 */
export async function getMarksOfAll(mediaIds: string[]): Promise<Marks> {
  const ids = [...new Set(mediaIds)];
  const requests: Promise<Marks>[] = [];
  for (let start = 0; start < ids.length; start += TITLES_PER_REQUEST) {
    requests.push(getMarks(ids.slice(start, start + TITLES_PER_REQUEST)));
  }
  const marks = await Promise.all(requests);
  return {
    status: new Map(marks.flatMap((batch) => [...batch.status])),
    rating: new Map(marks.flatMap((batch) => [...batch.rating])),
  };
}

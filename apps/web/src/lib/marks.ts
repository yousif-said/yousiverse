import type { LibraryStatus } from "@/lib/library";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export type Marks = {
  /** The signed-in person's library status for a title, by media id. */
  status: Map<string, LibraryStatus>;
  /** Their own rating of a title, in quarter points, by media id. */
  rating: Map<string, number>;
};

/**
 * What the signed-in person has done with each of these titles, for marking artwork and
 * showing their scores in lists of titles. Both maps are empty for a visitor.
 */
export async function getMarks(mediaIds: string[]): Promise<Marks> {
  const ids = [...new Set(mediaIds)];
  if (ids.length === 0 || !(await getSession())) return { status: new Map(), rating: new Map() };
  const queryClient = getQueryClient();
  const [statuses, ratings] = await Promise.all([
    queryClient.fetchQuery(trpc.library.statuses.queryOptions({ mediaIds: ids })),
    queryClient.fetchQuery(trpc.ratings.mine.queryOptions({ mediaIds: ids })),
  ]);
  return {
    status: new Map(statuses.map((entry) => [entry.mediaId, entry.status])),
    rating: new Map(ratings.map((rating) => [rating.mediaId, rating.value])),
  };
}

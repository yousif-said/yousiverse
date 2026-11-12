import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import { episodes, media, seasons } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

/** What a rating or review is about: a whole title, or one episode of a TV show. */
export const target = z.union([z.object({ mediaId: z.uuid() }), z.object({ episodeId: z.uuid() })]);
export type Target = z.infer<typeof target>;

/** Checks the target exists and returns the ids stored with a rating or review of it. */
export async function resolveTarget(
  db: Database,
  target: Target,
): Promise<{ mediaId: string; episodeId: string | null }> {
  if ("episodeId" in target) {
    const [episode] = await db
      .select({ mediaId: seasons.mediaId })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .where(eq(episodes.id, target.episodeId));
    if (!episode) throw new TRPCError({ code: "NOT_FOUND" });
    return { mediaId: episode.mediaId, episodeId: target.episodeId };
  }

  const [title] = await db.select({ id: media.id }).from(media).where(eq(media.id, target.mediaId));
  if (!title) throw new TRPCError({ code: "NOT_FOUND" });
  return { mediaId: title.id, episodeId: null };
}

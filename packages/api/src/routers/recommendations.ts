import { libraryEntries, media, ratings, similarTitles } from "@yousiverse/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { ensureSimilar } from "../recommendations/similar";
import { protectedProcedure, router } from "../trpc";

/** A title counts as liked from 7 out of 10, in quarter points. */
const LIKED_FROM = 28;
const MAX_LIKED_TITLES = 8;
const TITLES_PER_ROW = 6;

export const recommendationsRouter = router({
  /**
   * Titles like the ones the signed-in person rated highest, one row per liked title. Leaves out
   * everything already in their library or rated by them, and shows each suggestion once.
   */
  forYou: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const liked = await ctx.db
      .select({
        id: media.id,
        type: media.type,
        providerId: media.providerId,
        title: media.title,
        rating: ratings.value,
      })
      .from(ratings)
      .innerJoin(media, eq(media.id, ratings.mediaId))
      .where(
        and(
          eq(ratings.userId, userId),
          isNull(ratings.episodeId),
          gte(ratings.value, LIKED_FROM),
          isNotNull(media.providerId),
        ),
      )
      .orderBy(desc(ratings.value), desc(ratings.updatedAt), asc(media.id))
      .limit(MAX_LIKED_TITLES);
    const seeds = liked.flatMap((title) =>
      title.providerId ? { ...title, providerId: title.providerId } : [],
    );
    if (seeds.length === 0) return { rows: [], hasLikedTitles: false, incomplete: false };

    // One at a time: several of these can go to the same provider, which limits requests.
    let incomplete = false;
    for (const seed of seeds) {
      if (!(await ensureSimilar(ctx.db, seed))) incomplete = true;
    }

    const [similar, known] = await Promise.all([
      ctx.db
        .select({
          mediaId: similarTitles.mediaId,
          type: similarTitles.type,
          providerId: similarTitles.providerId,
          title: similarTitles.title,
          releaseYear: similarTitles.releaseYear,
          posterUrl: similarTitles.posterUrl,
        })
        .from(similarTitles)
        .where(
          inArray(
            similarTitles.mediaId,
            seeds.map((seed) => seed.id),
          ),
        )
        .orderBy(asc(similarTitles.position)),
      ctx.db
        .select({ type: media.type, providerId: media.providerId })
        .from(media)
        .where(
          or(
            inArray(
              media.id,
              ctx.db
                .select({ mediaId: libraryEntries.mediaId })
                .from(libraryEntries)
                .where(eq(libraryEntries.userId, userId)),
            ),
            inArray(
              media.id,
              ctx.db
                .select({ mediaId: ratings.mediaId })
                .from(ratings)
                .where(eq(ratings.userId, userId)),
            ),
          ),
        ),
    ]);

    const taken = new Set(known.map((title) => `${title.type}:${title.providerId}`));
    const rows = seeds.flatMap(({ id, ...seed }) => {
      const titles = [];
      for (const { mediaId, ...title } of similar) {
        const key = `${title.type}:${title.providerId}`;
        if (mediaId !== id || taken.has(key)) continue;
        taken.add(key);
        titles.push(title);
        if (titles.length === TITLES_PER_ROW) break;
      }
      return titles.length > 0 ? { seed, titles } : [];
    });
    return { rows, hasLikedTitles: true, incomplete };
  }),
});

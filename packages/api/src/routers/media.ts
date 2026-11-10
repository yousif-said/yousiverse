import { media } from "@yousiverse/db/schema";
import { publicProcedure, router } from "../trpc";

export const mediaRouter = router({
  shelf: publicProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: media.id,
        type: media.type,
        title: media.title,
        releaseYear: media.releaseYear,
      })
      .from(media)
      .orderBy(media.title)
      .limit(24),
  ),
});

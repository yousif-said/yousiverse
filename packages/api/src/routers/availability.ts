import { TRPCError } from "@trpc/server";
import { offerKinds, streamingOffers, streamingServices } from "@yousiverse/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureStreamingOffers, findStreamableTitle } from "../availability/streaming";
import { publicProcedure, router } from "../trpc";

export const availabilityRouter = router({
  /**
   * Where a movie or TV show can be watched in the US. `offers` is null when that is not known
   * yet because the provider could not be reached.
   */
  streaming: publicProcedure
    .input(z.object({ mediaId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const title = await findStreamableTitle(ctx.db, input.mediaId);
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });

      const check = await ensureStreamingOffers(ctx.db, title);
      if (!check) return { offers: null };

      const offers = await ctx.db
        .select({
          id: streamingOffers.id,
          kind: streamingOffers.kind,
          service: streamingServices.name,
          priceCents: streamingOffers.priceCents,
          url: streamingOffers.url,
        })
        .from(streamingOffers)
        .innerJoin(streamingServices, eq(streamingServices.id, streamingOffers.serviceId))
        .where(eq(streamingOffers.mediaId, title.id))
        .orderBy(asc(streamingServices.name));
      // Grouped by kind in the order of `offerKinds`, cheapest first within a kind.
      offers.sort(
        (a, b) =>
          offerKinds.indexOf(a.kind) - offerKinds.indexOf(b.kind) ||
          (a.priceCents ?? 0) - (b.priceCents ?? 0),
      );
      return { offers, checkedAt: check.checkedAt, outOfDate: check.outOfDate };
    }),
});

import { TRPCError } from "@trpc/server";
import {
  gameDeals,
  offerKinds,
  streamingOffers,
  streamingServices,
  userSubscriptions,
} from "@yousiverse/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureGamePrices, findGame } from "../availability/game-prices";
import { ensureServiceList } from "../availability/services";
import { ensureStreamingOffers, findStreamableTitle } from "../availability/streaming";
import { type Context, publicProcedure, router } from "../trpc";

/** The services the signed-in person says they subscribe to. Null for a signed-out visitor. */
async function viewerSubscriptions(ctx: Context): Promise<Set<string> | null> {
  if (!ctx.session) return null;
  const rows = await ctx.db
    .select({ serviceId: userSubscriptions.serviceId })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, ctx.session.user.id));
  return new Set(rows.map((row) => row.serviceId));
}

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
      // An offer only names its service. The service's logo comes with the list of services.
      await ensureServiceList(ctx.db);

      const [found, subscribed] = await Promise.all([
        ctx.db
          .select({
            id: streamingOffers.id,
            kind: streamingOffers.kind,
            serviceId: streamingServices.id,
            service: streamingServices.name,
            /** The service's own logo. Null for a service seen only on a title's offers. */
            logoUrl: streamingServices.logoUrl,
            priceCents: streamingOffers.priceCents,
            url: streamingOffers.url,
          })
          .from(streamingOffers)
          .innerJoin(streamingServices, eq(streamingServices.id, streamingOffers.serviceId))
          .where(eq(streamingOffers.mediaId, title.id))
          .orderBy(asc(streamingServices.name)),
        viewerSubscriptions(ctx),
      ]);
      // Grouped by kind in the order of `offerKinds`, cheapest first within a kind.
      found.sort(
        (a, b) =>
          offerKinds.indexOf(a.kind) - offerKinds.indexOf(b.kind) ||
          (a.priceCents ?? 0) - (b.priceCents ?? 0),
      );
      const offers = found.map(({ serviceId, ...offer }) => ({
        ...offer,
        /** True when the signed-in person says they subscribe to this service. */
        included: offer.kind === "subscription" && (subscribed?.has(serviceId) ?? false),
      }));
      return {
        offers,
        checkedAt: check.checkedAt,
        outOfDate: check.outOfDate,
        /** How many subscriptions the signed-in person says they have. Null when signed out. */
        subscriptionCount: subscribed?.size ?? null,
      };
    }),

  /**
   * What a game costs in US PC stores, cheapest first. `deals` is null when that is not known
   * yet because the provider could not be reached.
   */
  gamePrices: publicProcedure
    .input(z.object({ mediaId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const game = await findGame(ctx.db, input.mediaId);
      if (!game) throw new TRPCError({ code: "NOT_FOUND" });

      const check = await ensureGamePrices(ctx.db, game);
      if (!check) return { deals: null };

      const deals = await ctx.db
        .select({
          id: gameDeals.id,
          shop: gameDeals.shop,
          priceCents: gameDeals.priceCents,
          regularPriceCents: gameDeals.regularPriceCents,
          url: gameDeals.url,
        })
        .from(gameDeals)
        .where(eq(gameDeals.mediaId, game.id))
        .orderBy(asc(gameDeals.priceCents), asc(gameDeals.shop));
      return {
        deals,
        /** False for a game with no Steam listing, which is how its PC prices are found. */
        onSteam: game.steamAppId !== null,
        lowestEverCents: check.lowestPriceCents,
        checkedAt: check.checkedAt,
        outOfDate: check.outOfDate,
      };
    }),
});

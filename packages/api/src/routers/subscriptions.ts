import { TRPCError } from "@trpc/server";
import { streamingServices, userSubscriptions } from "@yousiverse/db/schema";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { ensureServiceList } from "../availability/services";
import { protectedProcedure, router } from "../trpc";

export const subscriptionsRouter = router({
  /**
   * Every subscription service, most widely used first, with whether the signed-in person says
   * they have it. Null when the list is not known yet because the provider could not be reached.
   */
  services: protectedProcedure.query(async ({ ctx }) => {
    if (!(await ensureServiceList(ctx.db))) return null;

    return ctx.db
      .select({
        id: streamingServices.id,
        name: streamingServices.name,
        logoUrl: streamingServices.logoUrl,
        subscribed: sql<boolean>`${userSubscriptions.id} is not null`,
      })
      .from(streamingServices)
      .leftJoin(
        userSubscriptions,
        and(
          eq(userSubscriptions.serviceId, streamingServices.id),
          eq(userSubscriptions.userId, ctx.session.user.id),
        ),
      )
      .where(and(eq(streamingServices.subscription, true), isNotNull(streamingServices.rank)))
      .orderBy(asc(streamingServices.rank));
  }),

  /**
   * The services the signed-in person says they have, most widely used first. Reads only what
   * is stored, so it is safe on pages that must not reach a provider.
   */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: streamingServices.id,
        name: streamingServices.name,
        logoUrl: streamingServices.logoUrl,
      })
      .from(userSubscriptions)
      .innerJoin(streamingServices, eq(streamingServices.id, userSubscriptions.serviceId))
      .where(eq(userSubscriptions.userId, ctx.session.user.id))
      .orderBy(asc(streamingServices.rank), asc(streamingServices.name)),
  ),

  /** Says the signed-in person has, or no longer has, a subscription. */
  set: protectedProcedure
    .input(z.object({ serviceId: z.uuid(), subscribed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (!input.subscribed) {
        await ctx.db
          .delete(userSubscriptions)
          .where(
            and(
              eq(userSubscriptions.userId, userId),
              eq(userSubscriptions.serviceId, input.serviceId),
            ),
          );
        return;
      }

      const [service] = await ctx.db
        .select({ id: streamingServices.id })
        .from(streamingServices)
        .where(
          and(eq(streamingServices.id, input.serviceId), eq(streamingServices.subscription, true)),
        );
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db
        .insert(userSubscriptions)
        .values({ userId, serviceId: service.id })
        .onConflictDoNothing();
    }),
});

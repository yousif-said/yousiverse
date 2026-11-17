import { TRPCError } from "@trpc/server";
import {
  type AlertKind,
  alertKinds,
  alerts,
  emailPreferences,
  type MediaType,
  media,
  userSubscriptions,
} from "@yousiverse/db/schema";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { findMetAlerts } from "../alerts/conditions";
import { ensureEmailPreferences } from "../alerts/run";
import { ensureGamePrices, findGame } from "../availability/game-prices";
import { ensureStreamingOffers, findStreamableTitle } from "../availability/streaming";
import { protectedProcedure, publicProcedure, router } from "../trpc";

/** Which alerts each type of title can have. Books have no availability or price data. */
const KINDS_FOR: Record<MediaType, AlertKind[]> = {
  movie: ["on_my_subscriptions", "streamable"],
  tv: ["on_my_subscriptions", "streamable"],
  game: ["price_at_most"],
  book: [],
};

// Every waiting alert costs provider requests each day, so one person cannot hold too many.
const MAX_ALERTS_PER_PERSON = 100;
const MAX_TARGET_CENTS = 100_000;

const alertFields = {
  id: alerts.id,
  kind: alerts.kind,
  targetCents: alerts.targetCents,
  triggeredAt: alerts.triggeredAt,
  outcome: alerts.outcome,
};

export const alertsRouter = router({
  /** The signed-in person's alerts on one title, and which kinds that title can have. */
  forTitle: protectedProcedure
    .input(z.object({ mediaId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [[title], mine] = await Promise.all([
        ctx.db.select({ type: media.type }).from(media).where(eq(media.id, input.mediaId)),
        ctx.db
          .select(alertFields)
          .from(alerts)
          .where(and(eq(alerts.userId, ctx.session.user.id), eq(alerts.mediaId, input.mediaId)))
          .orderBy(asc(alerts.kind)),
      ]);
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });
      return { kinds: KINDS_FOR[title.type], alerts: mine };
    }),

  /**
   * Sets an alert on a title, replacing one of the same kind. Refused when what it would wait
   * for is already true, since there would be nothing to wait for.
   */
  set: protectedProcedure
    .input(
      z.object({
        mediaId: z.uuid(),
        kind: z.enum(alertKinds),
        /** For a price alert: the most to pay, in cents. */
        targetCents: z.number().int().min(1).max(MAX_TARGET_CENTS).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [title] = await ctx.db
        .select({ type: media.type })
        .from(media)
        .where(eq(media.id, input.mediaId));
      if (!title) throw new TRPCError({ code: "NOT_FOUND" });
      if (!KINDS_FOR[title.type].includes(input.kind)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That alert does not exist for this kind of title.",
        });
      }
      const isPrice = input.kind === "price_at_most";
      if (isPrice !== (input.targetCents !== undefined)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A price alert needs a price, and only a price alert takes one.",
        });
      }

      if (input.kind === "on_my_subscriptions") {
        const subscriptions = await ctx.db.$count(
          userSubscriptions,
          eq(userSubscriptions.userId, userId),
        );
        if (subscriptions === 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Tick the services you subscribe to on your account page first.",
          });
        }
      }
      const existing = await ctx.db.$count(alerts, eq(alerts.userId, userId));
      if (existing >= MAX_ALERTS_PER_PERSON) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `You can have ${MAX_ALERTS_PER_PERSON} alerts. Remove one you no longer need first.`,
        });
      }

      // Judge the alert against what is known now. A provider being down is no reason to refuse.
      if (isPrice) {
        const game = await findGame(ctx.db, input.mediaId);
        if (game) await ensureGamePrices(ctx.db, game);
      } else {
        const streamable = await findStreamableTitle(ctx.db, input.mediaId);
        if (streamable) await ensureStreamingOffers(ctx.db, streamable);
      }

      const fresh = {
        targetCents: input.targetCents ?? null,
        createdAt: new Date(),
        triggeredAt: null,
        outcome: null,
        notifiedAt: null,
      };
      const [alert] = await ctx.db
        .insert(alerts)
        .values({ userId, mediaId: input.mediaId, kind: input.kind, ...fresh })
        .onConflictDoUpdate({ target: [alerts.userId, alerts.mediaId, alerts.kind], set: fresh })
        .returning({ id: alerts.id });
      if (!alert) throw new Error("Setting an alert returned no row.");

      const [alreadyTrue] = await findMetAlerts(ctx.db, alert.id);
      if (alreadyTrue) {
        await ctx.db.delete(alerts).where(eq(alerts.id, alert.id));
        throw new TRPCError({
          code: "CONFLICT",
          message: `No alert needed: it is ${alreadyTrue.outcome}.`,
        });
      }
      await ensureEmailPreferences(ctx.db, userId);
      return alert;
    }),

  /** Removes one of the signed-in person's alerts. */
  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const removed = await ctx.db
      .delete(alerts)
      .where(and(eq(alerts.id, input.id), eq(alerts.userId, ctx.session.user.id)))
      .returning({ id: alerts.id });
    if (removed.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
  }),

  /**
   * Everything the signed-in person has asked to be told about: alerts that came through first,
   * newest first, then the ones still waiting by title. Also whether they get alert emails.
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [mine, [preferences]] = await Promise.all([
      ctx.db
        .select({
          ...alertFields,
          title: {
            type: media.type,
            providerId: media.providerId,
            title: media.title,
            releaseYear: media.releaseYear,
          },
        })
        .from(alerts)
        .innerJoin(media, eq(media.id, alerts.mediaId))
        .where(and(eq(alerts.userId, userId), isNotNull(media.providerId)))
        .orderBy(sql`${alerts.triggeredAt} desc nulls last`, asc(media.title), desc(alerts.id)),
      ctx.db
        .select({ alertEmails: emailPreferences.alertEmails })
        .from(emailPreferences)
        .where(eq(emailPreferences.userId, userId)),
    ]);
    return {
      alerts: mine.flatMap(({ title, ...alert }) =>
        title.providerId ? { ...alert, title: { ...title, providerId: title.providerId } } : [],
      ),
      emails: preferences?.alertEmails ?? true,
    };
  }),

  /** Turns the signed-in person's alert emails on or off. Alerts still show in the app. */
  setEmails: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ensureEmailPreferences(ctx.db, userId);
      await ctx.db
        .update(emailPreferences)
        .set({ alertEmails: input.enabled })
        .where(eq(emailPreferences.userId, userId));
    }),

  /**
   * Turns alert emails off for whoever holds this unsubscribe link, with no need to sign in:
   * the link is in every alert email. An unknown link is answered the same way, so a link says
   * nothing about who has an account.
   */
  unsubscribe: publicProcedure
    .input(z.object({ token: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(emailPreferences)
        .set({ alertEmails: false })
        .where(eq(emailPreferences.unsubscribeToken, input.token));
    }),
});

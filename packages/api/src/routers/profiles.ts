import { TRPCError } from "@trpc/server";
import { profiles, users } from "@yousiverse/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

/** 3 to 20 lowercase letters, digits, or underscores. Capitals are lowered, not rejected. */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

export const profilesRouter = router({
  /** The signed-in person's own name and username. The username is null until they choose one. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const [me] = await ctx.db
      .select({ name: users.name, username: profiles.username })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, ctx.session.user.id));
    if (!me) throw new TRPCError({ code: "NOT_FOUND" });
    return me;
  }),

  /** Sets the display name and chooses or changes the username. Answers CONFLICT if it is taken. */
  save: protectedProcedure
    .input(z.object({ username, name: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [taken] = await ctx.db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(and(eq(profiles.username, input.username), ne(profiles.userId, userId)));
      if (taken) throw new TRPCError({ code: "CONFLICT", message: "That username is taken." });

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(profiles)
          .values({ userId, username: input.username })
          .onConflictDoUpdate({ target: profiles.userId, set: { username: input.username } });
        await tx.update(users).set({ name: input.name }).where(eq(users.id, userId));
      });
      return input;
    }),
});

import { initTRPC, TRPCError } from "@trpc/server";
import { auth, type Session } from "@yousiverse/auth";
import { type Database, db } from "@yousiverse/db";

export type Context = { db: Database; session: Session | null };

export async function createTRPCContext({ headers }: { headers: Headers }): Promise<Context> {
  return { db, session: await auth.api.getSession({ headers }) };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

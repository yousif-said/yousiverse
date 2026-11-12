import { initTRPC, TRPCError } from "@trpc/server";
import { auth, type Session } from "@yousiverse/auth";
import { type Database, db } from "@yousiverse/db";
import { ProviderError, type ProviderErrorKind } from "@yousiverse/integrations/errors";

export type Context = { db: Database; session: Session | null };

export async function createTRPCContext({ headers }: { headers: Headers }): Promise<Context> {
  return { db, session: await auth.api.getSession({ headers }) };
}

const t = initTRPC.context<Context>().create();

const providerErrorCodes = {
  not_found: "NOT_FOUND",
  rate_limited: "TOO_MANY_REQUESTS",
  unavailable: "SERVICE_UNAVAILABLE",
  invalid_response: "BAD_GATEWAY",
} satisfies Record<ProviderErrorKind, TRPCError["code"]>;

/** Turns a failed call to an external provider into the matching API error. */
const providerErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof ProviderError) {
    const { cause } = result.error;
    throw new TRPCError({ code: providerErrorCodes[cause.kind], message: cause.message, cause });
  }
  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(providerErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

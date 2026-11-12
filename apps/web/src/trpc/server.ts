import { TRPCError } from "@trpc/server";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { appRouter, createTRPCContext } from "@yousiverse/api";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

/** tRPC for Server Components: calls procedures directly, with no HTTP round trip. */
export const trpc = createTRPCOptionsProxy({
  ctx: async () => createTRPCContext({ headers: await headers() }),
  router: appRouter,
  queryClient: getQueryClient,
});

/** For pages built around one record: shows the not-found page when the API has no such record. */
export async function orNotFound<Data>(query: Promise<Data>): Promise<Data> {
  try {
    return await query;
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
    ) {
      notFound();
    }
    throw error;
  }
}

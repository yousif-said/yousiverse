import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { appRouter, createTRPCContext } from "@yousiverse/api";
import { headers } from "next/headers";
import { cache } from "react";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

/** tRPC for Server Components: calls procedures directly, with no HTTP round trip. */
export const trpc = createTRPCOptionsProxy({
  ctx: async () => createTRPCContext({ headers: await headers() }),
  router: appRouter,
  queryClient: getQueryClient,
});

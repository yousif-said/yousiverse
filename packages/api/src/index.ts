import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

export { type AppRouter, appRouter } from "./root";
export { createTRPCContext } from "./trpc";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

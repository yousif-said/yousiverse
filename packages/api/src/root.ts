import { catalogRouter } from "./routers/catalog";
import { mediaRouter } from "./routers/media";
import { router } from "./trpc";

export const appRouter = router({
  catalog: catalogRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;

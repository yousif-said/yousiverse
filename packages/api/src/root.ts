import { catalogRouter } from "./routers/catalog";
import { libraryRouter } from "./routers/library";
import { mediaRouter } from "./routers/media";
import { router } from "./trpc";

export const appRouter = router({
  catalog: catalogRouter,
  library: libraryRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;

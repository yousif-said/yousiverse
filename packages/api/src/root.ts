import { catalogRouter } from "./routers/catalog";
import { libraryRouter } from "./routers/library";
import { mediaRouter } from "./routers/media";
import { ratingsRouter } from "./routers/ratings";
import { router } from "./trpc";

export const appRouter = router({
  catalog: catalogRouter,
  library: libraryRouter,
  media: mediaRouter,
  ratings: ratingsRouter,
});

export type AppRouter = typeof appRouter;

import { availabilityRouter } from "./routers/availability";
import { catalogRouter } from "./routers/catalog";
import { libraryRouter } from "./routers/library";
import { listsRouter } from "./routers/lists";
import { mediaRouter } from "./routers/media";
import { profilesRouter } from "./routers/profiles";
import { ratingsRouter } from "./routers/ratings";
import { reviewsRouter } from "./routers/reviews";
import { subscriptionsRouter } from "./routers/subscriptions";
import { router } from "./trpc";

export const appRouter = router({
  availability: availabilityRouter,
  catalog: catalogRouter,
  library: libraryRouter,
  lists: listsRouter,
  media: mediaRouter,
  profiles: profilesRouter,
  ratings: ratingsRouter,
  reviews: reviewsRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;

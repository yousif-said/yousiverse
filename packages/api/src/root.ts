import { availabilityRouter } from "./routers/availability";
import { catalogRouter } from "./routers/catalog";
import { clubsRouter } from "./routers/clubs";
import { feedRouter } from "./routers/feed";
import { followsRouter } from "./routers/follows";
import { importsRouter } from "./routers/imports";
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
  clubs: clubsRouter,
  feed: feedRouter,
  follows: followsRouter,
  imports: importsRouter,
  library: libraryRouter,
  lists: listsRouter,
  media: mediaRouter,
  profiles: profilesRouter,
  ratings: ratingsRouter,
  reviews: reviewsRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;

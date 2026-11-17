import { alertsRouter } from "./routers/alerts";
import { availabilityRouter } from "./routers/availability";
import { calendarRouter } from "./routers/calendar";
import { catalogRouter } from "./routers/catalog";
import { clubsRouter } from "./routers/clubs";
import { discussionsRouter } from "./routers/discussions";
import { feedRouter } from "./routers/feed";
import { followsRouter } from "./routers/follows";
import { importsRouter } from "./routers/imports";
import { libraryRouter } from "./routers/library";
import { linksRouter } from "./routers/links";
import { listsRouter } from "./routers/lists";
import { mediaRouter } from "./routers/media";
import { profilesRouter } from "./routers/profiles";
import { ratingsRouter } from "./routers/ratings";
import { recommendationsRouter } from "./routers/recommendations";
import { reviewsRouter } from "./routers/reviews";
import { subscriptionsRouter } from "./routers/subscriptions";
import { router } from "./trpc";

export const appRouter = router({
  alerts: alertsRouter,
  availability: availabilityRouter,
  calendar: calendarRouter,
  catalog: catalogRouter,
  clubs: clubsRouter,
  discussions: discussionsRouter,
  feed: feedRouter,
  follows: followsRouter,
  imports: importsRouter,
  library: libraryRouter,
  links: linksRouter,
  lists: listsRouter,
  media: mediaRouter,
  profiles: profilesRouter,
  ratings: ratingsRouter,
  recommendations: recommendationsRouter,
  reviews: reviewsRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;

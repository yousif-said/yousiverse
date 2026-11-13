import type { Database } from "@yousiverse/db";
import {
  availabilityChecks,
  media,
  streamingOffers,
  streamingServices,
} from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import { getStreamingOffers, type StreamingOffer } from "@yousiverse/integrations/watchmode";
import { eq, inArray } from "drizzle-orm";

const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type StreamableTitle = { id: string; type: "movie" | "tv"; providerId: string };

async function saveOffers(db: Database, mediaId: string, offers: StreamingOffer[]) {
  await db.transaction(async (tx) => {
    await tx.delete(streamingOffers).where(eq(streamingOffers.mediaId, mediaId));

    if (offers.length > 0) {
      const services = new Map(offers.map((offer) => [offer.serviceId, offer.serviceName]));
      await tx
        .insert(streamingServices)
        .values([...services].map(([watchmodeId, name]) => ({ watchmodeId, name })))
        .onConflictDoNothing({ target: streamingServices.watchmodeId });
      const saved = await tx
        .select({ id: streamingServices.id, watchmodeId: streamingServices.watchmodeId })
        .from(streamingServices)
        .where(inArray(streamingServices.watchmodeId, [...services.keys()]));
      const serviceIds = new Map(saved.map((service) => [service.watchmodeId, service.id]));

      await tx.insert(streamingOffers).values(
        offers.flatMap((offer) => {
          const serviceId = serviceIds.get(offer.serviceId);
          return serviceId
            ? { mediaId, serviceId, kind: offer.kind, priceCents: offer.priceCents, url: offer.url }
            : [];
        }),
      );
    }

    const checkedAt = new Date();
    await tx
      .insert(availabilityChecks)
      .values({ mediaId, checkedAt })
      .onConflictDoUpdate({ target: availabilityChecks.mediaId, set: { checkedAt } });
  });
}

/**
 * Makes sure a title's stored offers are at most a week old, and says when they were checked.
 * Returns null when they have never been fetched and the provider cannot be reached.
 */
export async function ensureStreamingOffers(
  db: Database,
  title: StreamableTitle,
): Promise<{ checkedAt: Date; outOfDate: boolean } | null> {
  const [check] = await db
    .select({ checkedAt: availabilityChecks.checkedAt })
    .from(availabilityChecks)
    .where(eq(availabilityChecks.mediaId, title.id));
  if (check && Date.now() - check.checkedAt.getTime() < RECHECK_AFTER_MS) {
    return { checkedAt: check.checkedAt, outOfDate: false };
  }

  try {
    await saveOffers(db, title.id, await getStreamingOffers(title.type, title.providerId));
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    if (error.kind === "not_found") {
      // The provider does not know this title, which is an answer: nowhere to watch it.
      await saveOffers(db, title.id, []);
    } else {
      console.warn(`Could not check where to watch ${title.type} ${title.providerId}.`, error);
      return check ? { checkedAt: check.checkedAt, outOfDate: true } : null;
    }
  }
  return { checkedAt: new Date(), outOfDate: false };
}

/** The movie or TV show with this id, if it is one that streaming offers exist for. */
export async function findStreamableTitle(
  db: Database,
  mediaId: string,
): Promise<StreamableTitle | null> {
  const [title] = await db
    .select({
      id: media.id,
      type: media.type,
      provider: media.provider,
      providerId: media.providerId,
    })
    .from(media)
    .where(eq(media.id, mediaId));
  if (title?.provider !== "tmdb" || !title.providerId) return null;
  if (title.type !== "movie" && title.type !== "tv") return null;
  return { id: title.id, type: title.type, providerId: title.providerId };
}

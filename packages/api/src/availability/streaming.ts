import type { Database } from "@yousiverse/db";
import { media, streamingOffers, streamingServices } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import { getStreamingOffers, type StreamingOffer } from "@yousiverse/integrations/watchmode";
import { eq, inArray } from "drizzle-orm";
import { ensureChecked, recordCheck } from "./check";

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
    await recordCheck(tx, mediaId);
  });
}

async function fetchOffers(title: StreamableTitle): Promise<StreamingOffer[]> {
  try {
    return await getStreamingOffers(title.type, title.providerId);
  } catch (error) {
    // The provider not knowing a title is an answer: there is nowhere to watch it.
    if (error instanceof ProviderError && error.kind === "not_found") return [];
    throw error;
  }
}

/** Makes sure a movie's or show's stored offers are at most a week old. */
export function ensureStreamingOffers(db: Database, title: StreamableTitle) {
  return ensureChecked(db, title.id, async () =>
    saveOffers(db, title.id, await fetchOffers(title)),
  );
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

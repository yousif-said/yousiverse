import type { Database } from "@yousiverse/db";
import { streamingServices } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import { getStreamingServices } from "@yousiverse/integrations/watchmode";
import { max } from "drizzle-orm";
import { fromIncomingRow } from "../catalog/import";

const RELIST_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Makes sure the stored list of streaming services is at most a month old. Returns false when
 * no list has ever been stored and the provider cannot be reached.
 */
export async function ensureServiceList(db: Database): Promise<boolean> {
  const [stored] = await db
    .select({ listedAt: max(streamingServices.listedAt) })
    .from(streamingServices);
  const listedAt = stored?.listedAt ?? null;
  if (listedAt && Date.now() - listedAt.getTime() < RELIST_AFTER_MS) return true;

  let services: Awaited<ReturnType<typeof getStreamingServices>>;
  try {
    services = await getStreamingServices();
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    console.warn("Could not refresh the list of streaming services.", error);
    return listedAt !== null;
  }
  if (services.length === 0) return listedAt !== null;

  const now = new Date();
  await db
    .insert(streamingServices)
    .values(
      services.map((service, rank) => ({
        watchmodeId: service.id,
        name: service.name,
        subscription: service.subscription,
        rank,
        listedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: streamingServices.watchmodeId,
      set: fromIncomingRow(["name", "subscription", "rank", "listedAt"]),
    });
  return true;
}

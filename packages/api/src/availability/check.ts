import type { Database } from "@yousiverse/db";
import { availabilityChecks } from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import { eq } from "drizzle-orm";

const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AvailabilityCheck = {
  checkedAt: Date;
  /** True when the stored answer is over a week old and could not be fetched again. */
  outOfDate: boolean;
  lowestPriceCents: number | null;
};

/** Records that a title's availability was just fetched. Call it alongside saving the answer. */
export async function recordCheck(
  tx: Transaction,
  mediaId: string,
  lowestPriceCents: number | null = null,
) {
  const values = { checkedAt: new Date(), lowestPriceCents };
  await tx
    .insert(availabilityChecks)
    .values({ mediaId, ...values })
    .onConflictDoUpdate({ target: availabilityChecks.mediaId, set: values });
}

function readCheck(db: Database, mediaId: string) {
  return db
    .select({
      checkedAt: availabilityChecks.checkedAt,
      lowestPriceCents: availabilityChecks.lowestPriceCents,
    })
    .from(availabilityChecks)
    .where(eq(availabilityChecks.mediaId, mediaId));
}

/**
 * Makes sure a title's stored availability is at most a week old, running `refresh` (which must
 * call `recordCheck`) when it is not. Returns null when nothing has ever been stored and the
 * provider cannot be reached.
 */
export async function ensureChecked(
  db: Database,
  mediaId: string,
  refresh: () => Promise<void>,
): Promise<AvailabilityCheck | null> {
  const [stored] = await readCheck(db, mediaId);
  if (stored && Date.now() - stored.checkedAt.getTime() < RECHECK_AFTER_MS) {
    return { ...stored, outOfDate: false };
  }

  try {
    await refresh();
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    console.warn(`Could not check availability for media ${mediaId}.`, error);
    return stored ? { ...stored, outOfDate: true } : null;
  }
  const [fresh] = await readCheck(db, mediaId);
  if (!fresh) throw new Error(`Refreshing availability for ${mediaId} recorded no check.`);
  return { ...fresh, outOfDate: false };
}

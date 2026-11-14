import type { Database } from "@yousiverse/db";
import {
  type ImportItemState,
  importItems,
  type imports,
  libraryEntries,
  ratings,
  reviews,
} from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ensureListed } from "../catalog/import";

/** How many rows one request matches. Small enough to finish well inside a request's time limit. */
const BATCH_SIZE = 8;

type Import = typeof imports.$inferSelect;
type Item = typeof importItems.$inferSelect;

/** Finds the catalog title an imported row names, or null when there is no confident match. */
async function findTitle(item: Item): Promise<CatalogSearchResult | null> {
  if (item.externalKind === "imdb" && item.externalId) {
    return tmdb.findByImdbId(item.externalId);
  }
  if (item.type === "movie") return tmdb.findMovie(item.title, item.year);
  return null;
}

/**
 * Adds what a row says to its owner's library. Nothing the person already has is changed: an
 * existing library entry, rating, or review for the title stays exactly as it is.
 */
async function apply(db: Database, job: Import, item: Item, mediaId: string): Promise<boolean> {
  const { userId, visibility } = job;
  return db.transaction(async (tx) => {
    const added = await Promise.all([
      item.status
        ? tx
            .insert(libraryEntries)
            .values({ userId, mediaId, status: item.status, visibility })
            .onConflictDoNothing()
            .returning({ id: libraryEntries.id })
        : [],
      item.rating !== null
        ? tx
            .insert(ratings)
            .values({ userId, mediaId, value: item.rating })
            .onConflictDoNothing()
            .returning({ id: ratings.id })
        : [],
      item.review
        ? tx
            .insert(reviews)
            .values({ userId, mediaId, body: item.review, visibility })
            .onConflictDoNothing()
            .returning({ id: reviews.id })
        : [],
    ]);
    return added.some((rows) => rows.length > 0);
  });
}

async function processItem(db: Database, job: Import, item: Item): Promise<ImportItemState> {
  const found = await findTitle(item);
  if (!found) return "not_found";
  const mediaId = await ensureListed(db, found);
  const added = await apply(db, job, item, mediaId);
  await db.update(importItems).set({ mediaId }).where(eq(importItems.id, item.id));
  return added ? "imported" : "already";
}

/**
 * The states a row may be in for a result to be recorded. Two requests can work on the same row
 * at once (two tabs open on one import); only one of them adds anything, and the other must not
 * overwrite its "imported" with "already".
 */
function replaceable(result: ImportItemState): ImportItemState[] {
  return result === "imported" ? ["pending", "already"] : ["pending"];
}

/**
 * Matches the next few waiting rows of an import and adds them to the library. Returns
 * `paused: true` when a provider is busy or down: the rows it could not reach stay waiting,
 * and the caller should try again a little later.
 */
export async function processNextBatch(db: Database, job: Import): Promise<{ paused: boolean }> {
  const batch = await db
    .select()
    .from(importItems)
    .where(and(eq(importItems.importId, job.id), eq(importItems.state, "pending")))
    .orderBy(asc(importItems.position))
    .limit(BATCH_SIZE);

  let paused = false;
  await Promise.all(
    batch.map(async (item) => {
      let state: ImportItemState;
      try {
        state = await processItem(db, job, item);
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        if (error.kind === "rate_limited" || error.kind === "unavailable") {
          paused = true;
          return;
        }
        console.warn(`Import ${job.id}: could not match "${item.title}".`, error);
        state = error.kind === "not_found" ? "not_found" : "failed";
      }
      await db
        .update(importItems)
        .set({ state })
        .where(and(eq(importItems.id, item.id), inArray(importItems.state, replaceable(state))));
    }),
  );
  return { paused };
}

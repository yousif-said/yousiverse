import type { Database } from "@yousiverse/db";
import {
  type ImportItemState,
  type ImportSource,
  importItems,
  type imports,
  libraryEntries,
  ratings,
  reviews,
} from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as igdb from "@yousiverse/integrations/igdb";
import * as openLibrary from "@yousiverse/integrations/open-library";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ensureImported, ensureListed } from "../catalog/import";

/** How many rows one request matches. Small enough to finish well inside a request's time limit. */
const BATCH_SIZE = 8;
const BATCH_SIZE_ONE_AT_A_TIME = 4;
// Steam games need no request of their own once the batch has been looked up.
const BATCH_SIZE_STEAM = 40;

/**
 * Imports whose rows are looked up one after another. Open Library asks unregistered clients to
 * keep to about a request a second, so book lookups must not run side by side.
 */
const ONE_AT_A_TIME = new Set<ImportSource>(["goodreads", "storygraph"]);

function batchSize(source: ImportSource): number {
  if (source === "steam") return BATCH_SIZE_STEAM;
  return ONE_AT_A_TIME.has(source) ? BATCH_SIZE_ONE_AT_A_TIME : BATCH_SIZE;
}

type Import = typeof imports.$inferSelect;
type Item = typeof importItems.$inferSelect;

/** Games found ahead of time for a whole batch, by Steam id. */
type SteamGames = Map<string, CatalogSearchResult>;

/** Finds the catalog title an imported row names, or null when there is no confident match. */
async function findTitle(item: Item, steamGames: SteamGames): Promise<CatalogSearchResult | null> {
  if (item.externalKind === "steam") return steamGames.get(item.externalId ?? "") ?? null;
  if (item.externalKind === "imdb" && item.externalId) {
    return tmdb.findByImdbId(item.externalId);
  }
  if (item.type === "movie") return tmdb.findMovie(item.title, item.year);
  if (item.type === "book") {
    const isbn = item.externalKind === "isbn" ? item.externalId : null;
    return openLibrary.findBook({ isbn, title: item.title, author: item.creator });
  }
  return null;
}

/** The catalog title an imported row names, listed in the catalog if it was not yet. */
async function findMediaId(
  db: Database,
  item: Item,
  steamGames: SteamGames,
): Promise<string | null> {
  // A TMDB id names the title outright, so it is imported like a title someone opened.
  if (
    item.externalKind === "tmdb" &&
    item.externalId &&
    item.type !== "game" &&
    item.type !== "book"
  ) {
    return ensureImported(db, { type: item.type, providerId: item.externalId });
  }
  const found = await findTitle(item, steamGames);
  return found ? ensureListed(db, found) : null;
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
            .values({
              userId,
              mediaId,
              status: item.status,
              visibility,
              minutesPlayed: item.minutesPlayed,
            })
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

async function processItem(
  db: Database,
  job: Import,
  item: Item,
  steamGames: SteamGames,
): Promise<ImportItemState> {
  const mediaId = await findMediaId(db, item, steamGames);
  if (!mediaId) return "not_found";
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
    .limit(batchSize(job.source));

  // IGDB allows only a few requests a second, so a batch of Steam games is found in one request.
  let steamGames: SteamGames = new Map();
  const steamIds = batch.flatMap((item) =>
    item.externalKind === "steam" && item.externalId ? item.externalId : [],
  );
  if (steamIds.length > 0) {
    try {
      steamGames = await igdb.findBySteamIds(steamIds);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      console.warn(`Import ${job.id}: could not look up Steam games.`, error);
      return { paused: true };
    }
  }

  let paused = false;
  const process = async (item: Item) => {
    let state: ImportItemState;
    try {
      state = await processItem(db, job, item, steamGames);
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
  };

  if (ONE_AT_A_TIME.has(job.source)) {
    for (const item of batch) {
      if (paused) break;
      await process(item);
    }
  } else {
    await Promise.all(batch.map(process));
  }
  return { paused };
}

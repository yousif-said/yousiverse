import type { Database } from "@yousiverse/db";
import { books, type MediaType, similarChecks, similarTitles } from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import { ProviderError } from "@yousiverse/integrations/errors";
import * as igdb from "@yousiverse/integrations/igdb";
import * as openLibrary from "@yousiverse/integrations/open-library";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { eq } from "drizzle-orm";
import { ensureImported } from "../catalog/import";

// What a provider calls similar changes slowly, so it is kept longer than catalog data.
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SIMILAR_TITLES = 20;

export type SimilarSource = { id: string; type: MediaType; providerId: string };

async function fetchSimilar(db: Database, title: SimilarSource): Promise<CatalogSearchResult[]> {
  switch (title.type) {
    case "movie":
    case "tv":
      return tmdb.getSimilar(title.type, title.providerId);
    case "game":
      return igdb.getSimilar(title.providerId);
    case "book": {
      // Open Library has no similar books, so an author's other books stand in. The author is
      // known only once the book's details have loaded.
      const bookId = await ensureImported(db, title);
      const [book] = await db
        .select({ authors: books.authors })
        .from(books)
        .where(eq(books.mediaId, bookId));
      const [author] = book?.authors ?? [];
      return author ? openLibrary.getByAuthor(author) : [];
    }
  }
}

async function saveSimilar(db: Database, title: SimilarSource, found: CatalogSearchResult[]) {
  const unique = new Map(
    found
      .filter((other) => !(other.type === title.type && other.providerId === title.providerId))
      .map((other) => [`${other.type}:${other.providerId}`, other]),
  );
  const rows = [...unique.values()].slice(0, MAX_SIMILAR_TITLES).map((other, position) => ({
    mediaId: title.id,
    position,
    type: other.type,
    providerId: other.providerId,
    title: other.title,
    releaseYear: other.releaseYear,
    posterUrl: other.posterUrl,
    backdropUrl: other.backdropUrl,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(similarTitles).where(eq(similarTitles.mediaId, title.id));
    if (rows.length > 0) await tx.insert(similarTitles).values(rows);
    const checkedAt = new Date();
    await tx
      .insert(similarChecks)
      .values({ mediaId: title.id, checkedAt })
      .onConflictDoUpdate({ target: similarChecks.mediaId, set: { checkedAt } });
  });
}

/**
 * Makes sure a title's similar titles are stored and at most a month old. Returns false when
 * nothing is stored and the provider cannot be reached; an old list is served otherwise.
 */
export async function ensureSimilar(db: Database, title: SimilarSource): Promise<boolean> {
  const [stored] = await db
    .select({ checkedAt: similarChecks.checkedAt })
    .from(similarChecks)
    .where(eq(similarChecks.mediaId, title.id));
  if (stored && Date.now() - stored.checkedAt.getTime() < REFRESH_AFTER_MS) return true;

  try {
    await saveSimilar(db, title, await fetchSimilar(db, title));
    return true;
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    // The provider not knowing a title is an answer: nothing is similar to it.
    if (error.kind === "not_found") {
      await saveSimilar(db, title, []);
      return true;
    }
    console.warn(`Could not load titles similar to ${title.type} ${title.providerId}.`, error);
    return Boolean(stored);
  }
}

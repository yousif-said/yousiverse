import {
  type LibraryStatus,
  libraryEntries,
  type MediaType,
  media,
  mediaTypes,
} from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import * as igdb from "@yousiverse/integrations/igdb";
import * as openLibrary from "@yousiverse/integrations/open-library";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

type SearchProvider = {
  types: MediaType[];
  search: (query: string) => Promise<CatalogSearchResult[]>;
};

const searchProviders: SearchProvider[] = [
  { types: ["movie", "tv"], search: (query) => tmdb.search(query) },
  { types: ["game"], search: (query) => igdb.search(query) },
  { types: ["book"], search: (query) => openLibrary.search(query) },
];

/** Takes one result from each list in turn, so no provider's matches are buried under another's. */
function interleave<Item>(lists: Item[][]): Item[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, index) =>
    lists.flatMap((list) => list.slice(index, index + 1)),
  ).flat();
}

export const catalogRouter = router({
  /**
   * Searches the providers for the requested media types (all of them by default) at once.
   * A provider that fails does not fail the search: its media types are listed in
   * `unavailable` so the page can say what is missing. Each result carries the signed-in
   * person's library status for that title, or null.
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(100),
        types: z.array(z.enum(mediaTypes)).min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const wanted = new Set<MediaType>(input.types ?? mediaTypes);
      const providers = searchProviders.filter((provider) =>
        provider.types.some((type) => wanted.has(type)),
      );
      const outcomes = await Promise.allSettled(
        providers.map((provider) => provider.search(input.query)),
      );

      const resultLists: CatalogSearchResult[][] = [];
      const unavailable: MediaType[] = [];
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          resultLists.push(outcome.value.filter((result) => wanted.has(result.type)));
        } else {
          console.error("Catalog search failed for a provider.", outcome.reason);
          const failedTypes = providers[index]?.types ?? [];
          unavailable.push(...failedTypes.filter((type) => wanted.has(type)));
        }
      });
      const found = interleave(resultLists);

      const userId = ctx.session?.user.id;
      const inLibrary =
        userId && found.length > 0
          ? await ctx.db
              .select({
                type: media.type,
                providerId: media.providerId,
                status: libraryEntries.status,
              })
              .from(libraryEntries)
              .innerJoin(media, eq(media.id, libraryEntries.mediaId))
              .where(
                and(
                  eq(libraryEntries.userId, userId),
                  inArray(
                    media.providerId,
                    found.map((result) => result.providerId),
                  ),
                ),
              )
          : [];
      const statusOf = new Map<string, LibraryStatus>(
        inLibrary.map((entry) => [`${entry.type}:${entry.providerId}`, entry.status]),
      );
      const results = found.map((result) => ({
        ...result,
        status: statusOf.get(`${result.type}:${result.providerId}`) ?? null,
      }));
      return { results, unavailable };
    }),
});

import type { MediaType } from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import * as igdb from "@yousiverse/integrations/igdb";
import * as openLibrary from "@yousiverse/integrations/open-library";
import * as tmdb from "@yousiverse/integrations/tmdb";
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
   * Searches every provider at once. A provider that fails does not fail the search: its
   * media types are listed in `unavailable` so the page can say what is missing.
   */
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(1).max(100) }))
    .query(async ({ input }) => {
      const outcomes = await Promise.allSettled(
        searchProviders.map((provider) => provider.search(input.query)),
      );

      const resultLists: CatalogSearchResult[][] = [];
      const unavailable: MediaType[] = [];
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          resultLists.push(outcome.value);
        } else {
          console.error("Catalog search failed for a provider.", outcome.reason);
          unavailable.push(...(searchProviders[index]?.types ?? []));
        }
      });
      return { results: interleave(resultLists), unavailable };
    }),
});

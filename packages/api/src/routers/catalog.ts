import type { MediaType } from "@yousiverse/db/schema";
import type { CatalogSearchResult } from "@yousiverse/integrations/catalog";
import * as tmdb from "@yousiverse/integrations/tmdb";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

type SearchProvider = {
  types: MediaType[];
  search: (query: string) => Promise<CatalogSearchResult[]>;
};

const searchProviders: SearchProvider[] = [
  { types: ["movie", "tv"], search: (query) => tmdb.search(query) },
];

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

      const results: CatalogSearchResult[] = [];
      const unavailable: MediaType[] = [];
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          results.push(...outcome.value);
        } else {
          console.error("Catalog search failed for a provider.", outcome.reason);
          unavailable.push(...(searchProviders[index]?.types ?? []));
        }
      });
      return { results, unavailable };
    }),
});

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Cover } from "@/components/cover";
import { SearchBox } from "@/components/search-box";
import { MEDIA, mediaPath } from "@/lib/media";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Search" };

const gridClasses = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

async function Results({ query }: { query: string }) {
  const { results, unavailable } = await getQueryClient().fetchQuery(
    trpc.catalog.search.queryOptions({ query }),
  );
  const unavailableLabels = unavailable.map((type) => MEDIA[type].label).join(" and ");

  return (
    <>
      {unavailable.length > 0 && (
        <p role="alert" className="mb-8 rounded-lg border bg-card p-4">
          {unavailableLabels} search is unavailable right now. Try again in a minute.
        </p>
      )}
      {results.length === 0 && unavailable.length === 0 && (
        <p className="text-muted-foreground">
          Nothing matches “{query}”. Check the spelling or try a shorter title.
        </p>
      )}
      <ul className={gridClasses}>
        {results.map((result) => (
          <li key={`${result.type}-${result.providerId}`}>
            <Link
              href={mediaPath(result.type, result.providerId)}
              className="group block rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Cover
                type={result.type}
                title={result.title}
                posterUrl={result.posterUrl}
                className="transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none"
              />
              <span className="mt-3 block leading-snug font-medium group-hover:underline">
                {result.title}
              </span>
              <span className="block text-sm text-muted-foreground">
                {MEDIA[result.type].singular}
                {result.releaseYear && `, ${result.releaseYear}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function ResultsPlaceholder() {
  return (
    <div className={gridClasses} role="status" aria-label="Searching">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical static placeholders
        <div key={index} className="aspect-[5/7] animate-pulse rounded-[3px] bg-muted" />
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  return (
    <section className="pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Search</h1>
      <div className="mt-6 max-w-2xl">
        <SearchBox initialQuery={query} />
      </div>
      <div className="mt-10">
        {query ? (
          <Suspense key={query} fallback={<ResultsPlaceholder />}>
            <Results query={query} />
          </Suspense>
        ) : (
          <p className="text-muted-foreground">
            Type a title to find a movie, TV show, game, or book.
          </p>
        )}
      </div>
    </section>
  );
}

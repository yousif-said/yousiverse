import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterPill } from "@/components/filter-pill";
import { SearchBox } from "@/components/search-box";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import { isMediaType, MEDIA, MEDIA_TYPES, type MediaType, searchPath } from "@/lib/media";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Search" };

/** How many results each media type shows when all four are on the page together. */
const PREVIEW_COUNT = 6;

const linkFocus = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

type SectionProps = { query: string; type: MediaType; preview: boolean };

async function Results({ query, type, preview }: SectionProps) {
  const { results, unavailable } = await getQueryClient().fetchQuery(
    trpc.catalog.search.queryOptions({ query, types: [type] }),
  );

  if (unavailable.length > 0) {
    return (
      <p role="alert" className="rounded-lg border bg-card p-4">
        {MEDIA[type].label} search is unavailable right now. Try again in a minute.
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="text-muted-foreground">
        No {MEDIA[type].plural} match “{query}”.
      </p>
    );
  }

  const shown = preview ? results.slice(0, PREVIEW_COUNT) : results;
  return (
    <>
      <ul className={titleGridClasses}>
        {shown.map((result) => (
          <li key={result.providerId}>
            <TitleCard {...result} />
          </li>
        ))}
      </ul>
      {shown.length < results.length && (
        <Link
          href={searchPath(query, type)}
          className={cn(
            "mt-6 inline-block rounded-sm font-medium text-primary underline-offset-4 hover:underline",
            linkFocus,
          )}
        >
          See all {results.length} {MEDIA[type].plural}
        </Link>
      )}
    </>
  );
}

function ResultsPlaceholder({ type }: { type: MediaType }) {
  return (
    <div className={titleGridClasses} role="status" aria-label={`Searching ${MEDIA[type].plural}`}>
      {Array.from({ length: PREVIEW_COUNT }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical static placeholders
        <div key={index} className="aspect-[5/7] animate-pulse rounded-[3px] bg-muted" />
      ))}
    </div>
  );
}

function TypeFilter({ query, selected }: { query: string; selected: MediaType | undefined }) {
  const options = [
    { type: undefined, label: "All", color: undefined },
    ...MEDIA_TYPES.map((type) => ({ type, label: MEDIA[type].label, color: MEDIA[type].color })),
  ];

  return (
    <nav aria-label="Filter results by type" className="mt-5 flex flex-wrap gap-2">
      {options.map(({ type, label, color }) => (
        <FilterPill
          key={label}
          href={searchPath(query, type)}
          selected={type === selected}
          color={color}
        >
          {label}
        </FilterPill>
      ))}
    </nav>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q, type } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);
  const selected = isMediaType(type) ? type : undefined;
  const sections = selected ? [selected] : MEDIA_TYPES;

  return (
    <section className="pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Search</h1>
      <div className="mt-6 max-w-2xl">
        <SearchBox initialQuery={query} type={selected} />
      </div>
      <TypeFilter query={query} selected={selected} />

      {query ? (
        // Each media type comes from a different source, so each section shows up as soon as
        // its own source answers instead of waiting for the slowest one.
        sections.map((sectionType) => (
          <section key={sectionType} aria-labelledby={`${sectionType}-results`} className="mt-12">
            <h2
              id={`${sectionType}-results`}
              className="mb-5 font-display text-2xl font-bold tracking-tight"
            >
              {MEDIA[sectionType].label}
            </h2>
            <Suspense
              key={`${sectionType}-${query}`}
              fallback={<ResultsPlaceholder type={sectionType} />}
            >
              <Results query={query} type={sectionType} preview={!selected} />
            </Suspense>
          </section>
        ))
      ) : (
        <p className="mt-10 text-muted-foreground">
          Type a title to find a movie, TV show, game, or book.
        </p>
      )}
    </section>
  );
}

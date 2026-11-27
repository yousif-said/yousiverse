import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchField } from "@/components/find/search-field";
import {
  NothingFound,
  PeopleResults,
  ResultCount,
  ResultsPlaceholder,
  TitleResults,
  UniverseResults,
} from "@/components/find/search-results";
import { type LinkChoice, LinkTabs } from "@/components/ui/link-tabs";
import { isMediaType, MEDIA, MEDIA_TYPES, type MediaType, searchPath } from "@/lib/media";

const queryOf = (q: string | string[] | undefined) =>
  (typeof q === "string" ? q : "").trim().slice(0, 100);

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const query = queryOf((await searchParams).q);
  return { title: query ? `“${query}”` : "Search" };
}

/** The media types as tabs, each with how many titles match once its source has answered. */
function TypeTabs({ query, selected }: { query: string; selected: MediaType | undefined }) {
  const counted = (label: string, types: MediaType[]) => (
    <>
      {label}
      <Suspense key={query}>
        <ResultCount query={query} types={types} />
      </Suspense>
    </>
  );
  const choices: LinkChoice[] = [
    { href: searchPath(query), label: counted("Everything", MEDIA_TYPES), current: !selected },
    ...MEDIA_TYPES.map((type) => ({
      href: searchPath(query, type),
      label: counted(MEDIA[type].label, [type]),
      current: type === selected,
      icon: MEDIA[type].icon,
      iconClassName: `c-${type}`,
    })),
  ];
  return <LinkTabs label="Filter results by type" choices={choices} />;
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q, type } = await searchParams;
  const query = queryOf(q);
  const selected = isMediaType(type) ? type : undefined;
  const sections = selected ? [selected] : MEDIA_TYPES;

  return (
    <div className="page">
      <header className="ph" style={{ marginBottom: 20 }}>
        <div className="ph__text" style={{ width: "100%" }}>
          <h1 className="sr-only">Search</h1>
          <SearchField initialQuery={query} type={selected} />
        </div>
      </header>

      {query ? (
        <>
          <TypeTabs query={query} selected={selected} />
          {!selected && (
            <>
              <Suspense key={`people-${query}`}>
                <PeopleResults query={query} />
              </Suspense>
              <Suspense key={`universes-${query}`}>
                <UniverseResults query={query} />
              </Suspense>
            </>
          )}
          {/* Each medium comes from a different source, so each section shows up as soon as
              its own source answers instead of waiting for the slowest one. */}
          {sections.map((section) => (
            <Suspense key={`${section}-${query}`} fallback={<ResultsPlaceholder type={section} />}>
              <TitleResults query={query} type={section} preview={!selected} />
            </Suspense>
          ))}
          {!selected && (
            <Suspense key={`nothing-${query}`}>
              <NothingFound query={query} />
            </Suspense>
          )}
        </>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}>
          Start typing to search every movie, show, game, and book, and the people here.
          <br />
          <span className="hint">
            Press <span className="kbd">⌘K</span> from anywhere for the quick version.
          </span>
        </div>
      )}
    </div>
  );
}

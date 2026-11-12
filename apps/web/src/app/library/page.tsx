import type { Metadata } from "next";
import Link from "next/link";
import { FilterPill } from "@/components/filter-pill";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import {
  isLibraryStatus,
  LIBRARY_STATUSES,
  libraryPath,
  STATUS_LABELS,
  statusLabel,
} from "@/lib/library";
import { isMediaType, MEDIA, MEDIA_TYPES } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const params = await searchParams;
  const type = isMediaType(params.type) ? params.type : undefined;
  const status = isLibraryStatus(params.status) ? params.status : undefined;
  await requireSession(libraryPath(type, status));

  const entries = await getQueryClient().fetchQuery(
    trpc.library.list.queryOptions({ type, status }),
  );

  return (
    <section className="pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Library</h1>

      <nav aria-label="Filter by type" className="mt-6 flex flex-wrap gap-2">
        <FilterPill href={libraryPath(undefined, status)} selected={!type}>
          All
        </FilterPill>
        {MEDIA_TYPES.map((option) => (
          <FilterPill
            key={option}
            href={libraryPath(option, status)}
            selected={option === type}
            color={MEDIA[option].color}
          >
            {MEDIA[option].label}
          </FilterPill>
        ))}
      </nav>
      <nav aria-label="Filter by status" className="mt-3 flex flex-wrap gap-2">
        <FilterPill href={libraryPath(type)} selected={!status}>
          Any status
        </FilterPill>
        {LIBRARY_STATUSES.map((option) => (
          <FilterPill key={option} href={libraryPath(type, option)} selected={option === status}>
            {STATUS_LABELS[option]}
          </FilterPill>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          {type || status ? (
            "Nothing in your library matches these filters."
          ) : (
            <>
              Your library is empty.{" "}
              <Link
                href="/search"
                className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Search for a title
              </Link>{" "}
              and pick a status on its page to add it.
            </>
          )}
        </p>
      ) : (
        <ul className={`mt-10 ${titleGridClasses}`}>
          {entries.map((entry) => (
            <li key={entry.mediaId}>
              <TitleCard
                {...entry}
                note={
                  statusLabel(entry.status, entry.type) +
                  (entry.visibility === "private" ? ", only you" : "")
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

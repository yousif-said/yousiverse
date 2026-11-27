import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LibraryBoard } from "@/components/library/board";
import { EmptyLibrary, NothingMatches } from "@/components/library/empty";
import { LibraryShelves } from "@/components/library/shelves";
import { LibrarySkeleton } from "@/components/states/page-skeletons";
import { Icon } from "@/components/ui/icon";
import { LinkSegmented, LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { usToday } from "@/lib/days";
import { pluralize } from "@/lib/format";
import { isLibraryStatus, LIBRARY_STATUSES, STATUS_LABELS } from "@/lib/library";
import {
  isLibrarySort,
  isLibraryView,
  LIBRARY_SORTS,
  type LibraryChoices,
  libraryViewPath,
  SORT_LABELS,
} from "@/lib/library-view";
import { isMediaType, MEDIA, MEDIA_TYPES } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const params = await searchParams;
  const choices = {
    type: isMediaType(params.type) ? params.type : undefined,
    status: isLibraryStatus(params.status) ? params.status : undefined,
    sort: isLibrarySort(params.sort) ? params.sort : "recent",
    view: isLibraryView(params.view) ? params.view : "grid",
  } satisfies LibraryChoices;
  await requireSession(libraryViewPath(choices));
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <Library choices={choices} />
    </Suspense>
  );
}

type Choices = LibraryChoices & Required<Pick<LibraryChoices, "sort" | "view">>;

async function Library({ choices }: { choices: Choices }) {
  const { type, sort } = choices;
  const isBoard = choices.view === "board";
  // The board has a column for every status, so the status filter is for the shelves only.
  const status = isBoard ? undefined : choices.status;
  const { entries, counts } = await getQueryClient().fetchQuery(
    trpc.library.list.queryOptions({ type, status, sort }),
  );

  const countOf = (ofType: (typeof MEDIA_TYPES)[number]) =>
    counts.filter((row) => row.type === ofType).reduce((sum, row) => sum + row.count, 0);
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const pathWith = (change: LibraryChoices) => libraryViewPath({ ...choices, ...change });

  if (total === 0) {
    return (
      <div className="page">
        <PageHeader title="Library" lede="Everything you add, by status." />
        <EmptyLibrary />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Library"
        lede={`${pluralize(total, "title")}: ${[
          pluralize(countOf("movie"), "movie"),
          pluralize(countOf("tv"), "show"),
          pluralize(countOf("game"), "game"),
          pluralize(countOf("book"), "book"),
        ].join(", ")}.`}
        actions={
          <>
            <LinkSegmented
              small
              label="View"
              choices={[
                {
                  href: pathWith({ view: "grid" }),
                  label: "Shelves",
                  icon: "grid",
                  current: !isBoard,
                },
                {
                  href: pathWith({ view: "board" }),
                  label: "Board",
                  icon: "board",
                  current: isBoard,
                },
              ]}
            />
            <Link className="btn btn--soft btn--sm" href="/import">
              <Icon name="import" size="sm" />
              Import
            </Link>
          </>
        }
      />
      <LinkTabs
        label="Medium"
        choices={[
          {
            href: pathWith({ type: undefined }),
            label: "Everything",
            count: total,
            current: !type,
          },
          ...MEDIA_TYPES.map((option) => ({
            href: pathWith({ type: option }),
            label: MEDIA[option].label,
            count: countOf(option),
            current: option === type,
            icon: MEDIA[option].icon,
            iconClassName: `c-${option}`,
          })),
        ]}
      />
      <div className="toolbar">
        <div className="toolbar__group max-w-full min-w-0">
          {!isBoard && (
            <LinkSegmented
              small
              label="Status"
              choices={[
                { href: pathWith({ status: undefined }), label: "Any status", current: !status },
                ...LIBRARY_STATUSES.map((option) => ({
                  href: pathWith({ status: option }),
                  label: STATUS_LABELS[option],
                  current: option === status,
                })),
              ]}
            />
          )}
        </div>
        <div className="toolbar__group max-w-full min-w-0">
          <span className="hint">Sort</span>
          <LinkSegmented
            small
            label="Sort"
            choices={LIBRARY_SORTS.map((option) => ({
              href: pathWith({ sort: option }),
              label: SORT_LABELS[option],
              current: option === sort,
            }))}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <NothingMatches everythingHref={libraryViewPath({ sort, view: choices.view })} />
      ) : isBoard ? (
        <LibraryBoard entries={entries} sort={sort} />
      ) : (
        <LibraryShelves entries={entries} status={status} today={usToday()} />
      )}
    </div>
  );
}

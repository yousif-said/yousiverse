import type { Metadata } from "next";
import Link from "next/link";
import { ImportProgress } from "@/components/import-progress";
import { formatDay, pluralize } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/imports";
import { requireSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Import" };

const textLink =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function ImportDetailPage({ params }: PageProps<"/import/[id]">) {
  const { id } = await params;
  await requireSession(`/import/${id}`);
  const job = await orNotFound(getQueryClient().fetchQuery(trpc.imports.get.queryOptions({ id })));
  const { progress } = job;
  const finished = progress.pending === 0;

  const results = [
    { label: "Added to your library", count: progress.imported },
    { label: "Already here, left as they were", count: progress.already },
    { label: "Not found in the catalog", count: progress.not_found + progress.failed },
    { label: "Left out, such as single episodes", count: job.skippedCount },
  ].filter((result) => result.count > 0);

  return (
    <section className="max-w-2xl pt-10 sm:pt-16">
      <p className="text-sm">
        <Link href="/import" className={textLink}>
          Import
        </Link>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
        {SOURCE_LABELS[job.source]} import
      </h1>
      <p className="mt-3 text-muted-foreground">
        {pluralize(progress.total, "title")}, started {formatDay(new Date(job.createdAt))}
      </p>

      {/* Remounts when the counts change, so the loop always starts from what is stored. */}
      <ImportProgress key={progress.pending} importId={job.id} initialProgress={progress} />

      {finished && (
        <>
          <dl className="mt-8 divide-y rounded-lg border bg-card">
            {results.map(({ label, count }) => (
              <div key={label} className="flex items-baseline justify-between gap-6 px-5 py-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{count.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            <Link href="/library" className={textLink}>
              Open your library
            </Link>
          </p>
        </>
      )}

      {finished && job.unmatched.length > 0 && (
        <section aria-labelledby="unmatched-heading" className="mt-12">
          <h2 id="unmatched-heading" className="font-display text-2xl font-bold tracking-tight">
            Not found
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm text-pretty text-muted-foreground">
            These could not be matched to a title with confidence, so they were not added. Search
            for them and add them yourself.
          </p>
          <ul className="mt-4 divide-y border-y">
            {job.unmatched.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-6 px-1 py-3">
                <Link href={`/search?q=${encodeURIComponent(item.title)}`} className={textLink}>
                  {item.title}
                </Link>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {[item.creator, item.year].filter(Boolean).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { formatDay, pluralize } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/imports";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireSession("/import");
  const imports = await getQueryClient().fetchQuery(trpc.imports.mine.queryOptions());

  return (
    <section className="max-w-2xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Import</h1>
      <p className="mt-3 max-w-[65ch] text-pretty text-muted-foreground">
        Bring your history from another service into your library: what you have finished, what you
        want to get to, your ratings, and your reviews.
      </p>

      <div className="mt-8">
        <ImportForm />
      </div>

      {imports.length > 0 && (
        <section aria-labelledby="past-imports-heading" className="mt-14">
          <h2 id="past-imports-heading" className="font-display text-2xl font-bold tracking-tight">
            Your imports
          </h2>
          <ul className="mt-4 divide-y border-y">
            {imports.map((each) => (
              <li key={each.id}>
                <Link
                  href={`/import/${each.id}`}
                  className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="font-medium">
                    {SOURCE_LABELS[each.source]}, {formatDay(new Date(each.createdAt))}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {pluralize(each.total, "title")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

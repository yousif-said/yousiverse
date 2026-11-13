import type { Metadata } from "next";
import Link from "next/link";
import { CreateListForm } from "@/components/create-list-form";
import { pluralize } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { visibilityNote } from "@/lib/visibility";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage() {
  await requireSession("/lists");
  const lists = await getQueryClient().fetchQuery(trpc.lists.mine.queryOptions());

  return (
    <section className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Lists</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        Group movies, shows, games, and books any way you like. Add titles from their own pages.
      </p>

      <div className="mt-8">
        <CreateListForm />
      </div>

      {lists.length === 0 ? (
        <p className="mt-10 text-muted-foreground">You have no lists yet.</p>
      ) : (
        <ul className="mt-10 divide-y border-y">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">{list.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {pluralize(list.itemCount, "title")}
                  {visibilityNote(list.visibility)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

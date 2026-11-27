import type { Metadata } from "next";
import { ListDialog } from "@/components/together/list-dialog";
import { ListTile } from "@/components/together/list-tile";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHead } from "@/components/ui/section-head";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Lists" };

export default async function ListsPage() {
  await requireSession("/lists");
  const queryClient = getQueryClient();
  const [mine, fromFollowing] = await Promise.all([
    queryClient.fetchQuery(trpc.lists.mine.queryOptions()),
    queryClient.fetchQuery(trpc.lists.fromFollowing.queryOptions()),
  ]);

  return (
    <div className="page">
      <PageHeader
        title="Lists"
        lede="Any mix of movies, shows, games, and books, in the order you put them."
        actions={<ListDialog />}
      />
      <section aria-labelledby="your-lists-h">
        <SectionHead title="Yours" id="your-lists-h" />
        {mine.length === 0 ? (
          <div className="empty">
            You have no lists yet. Make one, then add titles to it from their own pages.
          </div>
        ) : (
          <div className="tiles">
            {mine.map((list) => (
              <ListTile key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>
      {fromFollowing.length > 0 && (
        <section className="section" aria-labelledby="followed-lists-h">
          <SectionHead title="From people you follow" id="followed-lists-h" />
          <div className="tiles">
            {fromFollowing.map((list) => (
              <ListTile key={list.id} list={list} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

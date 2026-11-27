import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { UniverseTile } from "@/components/universe/universe-tile";
import { universeProgress } from "@/lib/links";
import { getSession } from "@/lib/session";
import { getMarksOfAll } from "@/lib/universes";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Youniverses",
  description:
    "Books, films, shows, and games that tell one story, mapped across every medium they reach.",
};

/** Shown until a reviewer has linked two titles. Reviewers are pointed at where that is done. */
async function NoUniverses() {
  const canReview = await getQueryClient().fetchQuery(trpc.links.canReview.queryOptions());
  return (
    <div className="empty">
      <h2 className="d3">No Youniverses yet.</h2>
      <p style={{ marginTop: 12 }}>
        One appears here once a reviewer has linked two titles that belong together: a book and its
        film, a game and its sequel.
      </p>
      <Link
        className="btn btn--primary"
        href={canReview ? "/admin/links" : "/search"}
        style={{ marginTop: 20 }}
      >
        {canReview ? "Review suggested links" : "Find a title"}
      </Link>
    </div>
  );
}

export default async function YouniversesPage() {
  const [universes, session] = await Promise.all([
    getQueryClient().fetchQuery(trpc.links.universes.queryOptions()),
    getSession(),
  ]);
  const { status } = await getMarksOfAll(
    universes.flatMap((universe) => universe.titles.map((title) => title.mediaId)),
  );

  return (
    <div className="page">
      <PageHeader
        title="Youniverses"
        lede={`A story rarely stays in one medium. These are the books, films, shows, and games that belong together${session ? ", and how far through each you are" : ""}.`}
      />
      {universes.length === 0 ? (
        <NoUniverses />
      ) : (
        <div className="tiles">
          {universes.map((universe) => (
            <UniverseTile
              key={universe.id}
              universe={universe}
              heading="h2"
              finished={session ? universeProgress(universe.titles, status).finished : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

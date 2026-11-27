import type { Metadata } from "next";
import Link from "next/link";
import { ClubTile } from "@/components/together/club-tile";
import { StartClubButton } from "@/components/together/start-club-button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHead } from "@/components/ui/section-head";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Clubs" };

export default async function ClubsPage() {
  const session = await getSession();
  const queryClient = getQueryClient();
  const [mine, publicClubs] = await Promise.all([
    session ? queryClient.fetchQuery(trpc.clubs.mine.queryOptions()) : [],
    queryClient.fetchQuery(trpc.clubs.discover.queryOptions()),
  ]);
  const joined = new Set(mine.map((club) => club.id));
  const toJoin = publicClubs.filter((club) => !joined.has(club.id));

  return (
    <div className="page">
      <PageHeader
        title="Clubs"
        lede="A group around some kinds of titles: a book club, a film club, a club for everything. Each keeps to the kinds its owner chose."
        actions={
          session ? (
            <StartClubButton />
          ) : (
            <Link className="btn btn--primary" href="/sign-in?next=%2Fclubs">
              <Icon name="plus" />
              Start a club
            </Link>
          )
        }
      />

      {session && (
        <section aria-labelledby="your-clubs-h">
          <SectionHead title="Your clubs" id="your-clubs-h" />
          {mine.length === 0 ? (
            <div className="empty">
              You are not in any clubs yet. Start one, or join one of the public clubs below.
            </div>
          ) : (
            <div className="tiles">
              {mine.map((club) => (
                <ClubTile key={club.id} club={club} joined />
              ))}
            </div>
          )}
        </section>
      )}

      <section className={session ? "section" : undefined} aria-labelledby="open-clubs-h">
        <SectionHead title="Open to join" id="open-clubs-h" sub="Public clubs anyone can find" />
        {toJoin.length === 0 ? (
          <div className="empty">
            {publicClubs.length === 0
              ? "There are no public clubs yet."
              : "You are in every public club there is."}
          </div>
        ) : (
          <div className="tiles">
            {toJoin.map((club) => (
              <ClubTile key={club.id} club={club} joined={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

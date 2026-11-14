import type { RouterOutputs } from "@yousiverse/api";
import type { Metadata } from "next";
import Link from "next/link";
import { ClubForm } from "@/components/club-form";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { ACCESS_LABELS, clubPath, coveredTypes } from "@/lib/clubs";
import { pluralize } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Clubs" };

const sectionHeading = "font-display text-2xl font-bold tracking-tight";

function ClubList({ clubs }: { clubs: RouterOutputs["clubs"]["discover"] }) {
  return (
    <ul className="mt-4 divide-y border-y">
      {clubs.map((club) => (
        <li key={club.id}>
          <Link
            href={clubPath(club.id)}
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="font-medium">{club.name}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {pluralize(club.memberCount, "member")}
            </span>
            <span className="col-span-full text-sm text-muted-foreground">
              {coveredTypes(club.mediaTypes)}, {ACCESS_LABELS[club.access].label.toLowerCase()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
    <div className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Clubs</h1>
      <p className="mt-3 max-w-[65ch] text-pretty text-muted-foreground">
        A club is a group around some kinds of titles: a book club, a film club, a club for
        everything. Each club keeps to the kinds its owner chose.
      </p>

      {session && (
        <section aria-labelledby="your-clubs-heading" className="mt-12">
          <h2 id="your-clubs-heading" className={sectionHeading}>
            Your clubs
          </h2>
          {mine.length === 0 ? (
            <p className="mt-4 text-muted-foreground">You are not in any clubs yet.</p>
          ) : (
            <ClubList clubs={mine} />
          )}
        </section>
      )}

      <section aria-labelledby="public-clubs-heading" className="mt-12">
        <h2 id="public-clubs-heading" className={sectionHeading}>
          Public clubs
        </h2>
        {toJoin.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            {publicClubs.length === 0
              ? "There are no public clubs yet."
              : "You are in every public club there is."}
          </p>
        ) : (
          <ClubList clubs={toJoin} />
        )}
      </section>

      <section aria-labelledby="start-club-heading" className="mt-12 max-w-xl">
        <h2 id="start-club-heading" className={sectionHeading}>
          Start a club
        </h2>
        <div className="mt-4">
          {session ? (
            <ClubForm />
          ) : (
            <SignInPrompt returnTo="/clubs">to start a club or join one.</SignInPrompt>
          )}
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PeopleList } from "@/components/people-list";
import { profilePath } from "@/lib/profile";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/u/[username]/following">;

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage({ params }: Props) {
  const username = decodeURIComponent((await params).username);
  const queryClient = getQueryClient();
  const [profile, { people, unnamed }] = await orNotFound(
    Promise.all([
      queryClient.fetchQuery(trpc.profiles.get.queryOptions({ username })),
      queryClient.fetchQuery(trpc.follows.following.queryOptions({ username })),
    ]),
  );

  return (
    <section className="max-w-3xl pt-10 sm:pt-16">
      <p className="text-sm">
        <Link
          href={profilePath(profile.username)}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {profile.name}
        </Link>
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Following</h1>
      <div className="mt-8">
        {people.length === 0 && unnamed === 0 ? (
          <p className="text-muted-foreground">Not following anyone yet.</p>
        ) : (
          <PeopleList people={people} unnamed={unnamed} />
        )}
      </div>
    </section>
  );
}

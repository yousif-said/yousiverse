import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { FollowButton } from "@/components/follow-button";
import { PersonRow } from "@/components/people/person-row";
import { getViewer } from "@/components/shell/viewer";
import { FeedSkeleton } from "@/components/states/page-skeletons";
import { byDay } from "@/components/together/by-day";
import { Post } from "@/components/together/post";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { agoLabel } from "@/lib/days";
import { pluralize } from "@/lib/format";
import { profilePath } from "@/lib/profile";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Feed" };

/** How many of the people the viewer follows are listed beside the feed. */
const FOLLOWED_SHOWN = 5;

/** A page marker from the address bar, if it is one the feed can use. */
function pageMarker(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const before = pageMarker((await searchParams).before);
  await requireSession(before ? `/feed?before=${encodeURIComponent(before)}` : "/feed");
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <Feed before={before} />
    </Suspense>
  );
}

async function Feed({ before }: { before: string | undefined }) {
  const queryClient = getQueryClient();
  const [feed, followed, suggestions, viewer] = await Promise.all([
    queryClient.fetchQuery(trpc.feed.following.queryOptions({ before })),
    queryClient.fetchQuery(trpc.follows.mine.queryOptions({ limit: FOLLOWED_SHOWN })),
    queryClient.fetchQuery(trpc.follows.suggestions.queryOptions()),
    getViewer(),
  ]);
  const followedCount = pluralize(feed.followedCount, "person", "people");

  return (
    <div className="page">
      <PageHeader
        title="Feed"
        lede="What the people you follow have been watching, playing, and reading."
      />
      {before && (
        <div className="note mb-6">
          <Icon name="clock" />
          <span>
            Showing older activity.{" "}
            <Link className="link" href="/feed">
              Back to the newest
            </Link>
          </span>
        </div>
      )}
      <div className="feed">
        <div>
          {feed.items.length === 0 ? (
            <div className="empty">
              {before ? (
                "Nothing older than this."
              ) : feed.followedCount === 0 ? (
                <>
                  <p>
                    You are not following anyone yet. Find a person by name or username, then follow
                    them from their profile.
                  </p>
                  <Link className="btn btn--primary mt-4" href="/search">
                    <Icon name="search" />
                    Find people
                  </Link>
                </>
              ) : (
                "Nothing from the people you follow yet."
              )}
            </div>
          ) : (
            byDay(feed.items).map(({ day, items }) => (
              <Fragment key={day}>
                <h2 className="label feed__day">{agoLabel(day)}</h2>
                <ul>
                  {items.map((item) => (
                    <Post key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </ul>
              </Fragment>
            ))
          )}
          {feed.olderThan && (
            <Link
              className="btn btn--soft mt-6"
              href={`/feed?before=${encodeURIComponent(feed.olderThan)}`}
            >
              Older activity
            </Link>
          )}
        </div>
        <aside aria-label="People">
          {followed.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h2 className="label">You follow</h2>
                {viewer?.username ? (
                  <Link className="hint link" href={`${profilePath(viewer.username)}/following`}>
                    {followedCount}
                  </Link>
                ) : (
                  <span className="hint">{followedCount}</span>
                )}
              </div>
              <ul>
                {followed.map((person) => (
                  <PersonRow
                    key={person.username}
                    person={person}
                    note={person.followsYou ? "Friends" : undefined}
                  >
                    <FollowButton
                      username={person.username}
                      name={person.name}
                      followsYou={person.followsYou}
                      initiallyFollowing
                    />
                  </PersonRow>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="panel" style={followed.length > 0 ? { marginTop: 18 } : undefined}>
              <div className="panel__head">
                <h2 className="label">People to follow</h2>
              </div>
              <ul>
                {suggestions.map((person) => (
                  <PersonRow
                    key={person.username}
                    person={person}
                    note={person.followsYou ? "Follows you" : undefined}
                  >
                    <FollowButton
                      username={person.username}
                      name={person.name}
                      followsYou={person.followsYou}
                      initiallyFollowing={false}
                    />
                  </PersonRow>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

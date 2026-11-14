import type { RouterOutputs } from "@yousiverse/api";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberName } from "@/components/member-name";
import { formatDay, formatRating } from "@/lib/format";
import { activityPhrase } from "@/lib/library";
import { mediaPath } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Feed" };

type Item = RouterOutputs["feed"]["following"]["items"][number];

const titleLink =
  "rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textLink =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** One line saying who did what, with links to the person and the thing. */
function Headline({ item }: { item: Item }) {
  const who = <MemberName username={item.username} />;
  if (item.kind === "list") {
    return (
      <>
        {who} made the list{" "}
        <Link href={`/lists/${item.id}`} className={titleLink}>
          {item.name}
        </Link>
      </>
    );
  }

  const titlePath = mediaPath(item.type, item.providerId);
  if (item.kind === "library") {
    return (
      <>
        {who} {activityPhrase(item.status, item.type)}{" "}
        <Link href={titlePath} className={titleLink}>
          {item.title}
        </Link>
      </>
    );
  }
  const { episode } = item;
  return (
    <>
      {who} reviewed{" "}
      <Link
        href={
          episode
            ? `${titlePath}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`
            : titlePath
        }
        className={titleLink}
      >
        {episode ? `${item.title}: ${episode.name}` : item.title}
      </Link>
    </>
  );
}

export default async function FeedPage() {
  await requireSession("/feed");
  const feed = await getQueryClient().fetchQuery(trpc.feed.following.queryOptions());

  return (
    <section className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Feed</h1>
      <p className="mt-3 text-muted-foreground">
        What the people you follow have added, reviewed, and listed lately.
      </p>

      {feed.items.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          {feed.followedCount === 0 ? (
            <>
              You are not following anyone yet.{" "}
              <Link href="/search" className={textLink}>
                Search for a person
              </Link>{" "}
              by name or username, then follow them from their profile.
            </>
          ) : (
            "Nothing from the people you follow yet."
          )}
        </p>
      ) : (
        <ul className="mt-8 divide-y border-y">
          {feed.items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="grid grid-cols-[1fr_auto] gap-x-6 py-5">
              <div className="min-w-0">
                <p className="text-pretty">
                  <Headline item={item} />
                </p>
                <p className="text-sm text-muted-foreground">{formatDay(new Date(item.at))}</p>
                {item.kind === "review" && (
                  <p className="mt-3 line-clamp-4 max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
                    {item.body}
                  </p>
                )}
              </div>
              {item.kind !== "list" && item.rating !== null && (
                <p className="font-display text-3xl leading-none font-extrabold tabular-nums">
                  <span className="sr-only">Rated </span>
                  {formatRating(item.rating)}
                  <span className="sr-only"> out of 10</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

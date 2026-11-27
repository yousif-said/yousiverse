import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { MemberName } from "@/components/member-name";
import { Avatar } from "@/components/ui/avatar";
import { formatRating, pluralize } from "@/lib/format";
import { activityPhrase } from "@/lib/library";
import { mediaPath } from "@/lib/media";
import { tonedClass, toneStyle } from "@/lib/titles";

type FeedItem = RouterOutputs["feed"]["following"]["items"][number];

type HeadProps = {
  username: string;
  /** What they did: "is reading", "reviewed", "made the list". */
  verb: string;
  /** What they did it to, as a link. */
  children: React.ReactNode;
};

function Head({ username, verb, children }: HeadProps) {
  return (
    <p className="act__line">
      <b>
        <MemberName username={username} />
      </b>{" "}
      {verb} {children}
    </p>
  );
}

/**
 * The picture under a post, linking where the post's own words already link. It is kept out of
 * the tab order and away from screen readers, which get everything from the line above it.
 */
function Media({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="post__media" href={href} aria-hidden="true" tabIndex={-1}>
      {children}
    </Link>
  );
}

/** One thing a followed person did: changed their library, wrote a review, or made a list. */
export function Post({ item }: { item: FeedItem }) {
  if (item.kind === "list") {
    const href = `/lists/${item.id}`;
    return (
      <li className="post">
        <Avatar username={item.username} size={44} />
        <div>
          <Head username={item.username} verb="made the list">
            <Link href={href}>
              <b>{item.name}</b>
            </Link>
            <span className="sr-only">, {pluralize(item.itemCount, "title")}</span>
          </Head>
          <Media href={href}>
            <div className="fan">
              {item.artwork.map((title) => (
                <Thumb key={title.mediaId} title={title} link={false} />
              ))}
            </div>
            <div className="ml-auto text-right">
              <div className="hint">{pluralize(item.itemCount, "title")}</div>
            </div>
          </Media>
        </div>
      </li>
    );
  }

  const titlePath = mediaPath(item.type, item.providerId);
  const episode = item.kind === "review" ? item.episode : null;
  const href = episode
    ? `${titlePath}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`
    : titlePath;
  return (
    <li className={cn("post", tonedClass(item))} style={toneStyle(item)}>
      <Avatar username={item.username} size={44} />
      <div>
        <Head
          username={item.username}
          verb={item.kind === "review" ? "reviewed" : activityPhrase(item.status, item.type)}
        >
          <Link href={href}>
            <b>{episode ? `${item.title}: ${episode.name}` : item.title}</b>
          </Link>
          {item.rating !== null && (
            <span className="sr-only">, rated {formatRating(item.rating)} out of 10</span>
          )}
        </Head>
        {item.kind === "review" && (
          <blockquote className="post__quote line-clamp-4">“{item.body}”</blockquote>
        )}
        <Media href={href}>
          <Thumb title={item} link={false} />
          <div className="min-w-0">
            <div className="row__title">{item.title}</div>
            <div className="row__sub">
              <Medium type={item.type} />
              <span>{item.releaseYear ?? ""}</span>
            </div>
          </div>
          {item.rating !== null && (
            <div className="post__big ml-auto">{formatRating(item.rating)}</div>
          )}
        </Media>
      </div>
    </li>
  );
}

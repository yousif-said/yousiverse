import Link from "next/link";
import type { CSSProperties } from "react";
import { CameCard } from "@/components/alerts/came-card";
import { Thumb } from "@/components/media/artwork";
import { Meter } from "@/components/media/score";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { discussionPath } from "@/lib/clubs";
import { agoLabel, dayOf, midSentence } from "@/lib/days";
import { formatRating } from "@/lib/format";
import { type ActivityItem, episodeLabel, type HomeSummary } from "@/lib/home";
import { activityPhrase } from "@/lib/library";
import { mediaPath } from "@/lib/media";
import { profilePath } from "@/lib/profile";

/** Another person's rating, drawn like a score but never worded as the viewer's own. */
function TheirScore({ username, value }: { username: string; value: number }) {
  return (
    <span className="score score--mine" title={`${username}'s rating`}>
      <Meter value={(value / 40) * 100} />
      <span className="sr-only">rated </span>
      {formatRating(value)}
    </span>
  );
}

function Activity({ item, today }: { item: ActivityItem; today: string }) {
  const titleHref = mediaPath(item.title.type, item.title.providerId);
  const episode = item.kind === "review" ? item.episode : null;
  return (
    <li className="act">
      <Avatar username={item.username} size={38} />
      <div>
        <p className="act__line">
          <Link href={profilePath(item.username)} className="who">
            <b>{item.username}</b>
          </Link>{" "}
          {item.kind === "review" ? "reviewed" : activityPhrase(item.status, item.title.type)}{" "}
          <Link
            href={
              episode
                ? `${titleHref}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`
                : titleHref
            }
          >
            <b>{item.title.title}</b>
          </Link>
          {item.rating !== null && (
            <>
              {"  "}
              <TheirScore username={item.username} value={item.rating} />
            </>
          )}
        </p>
        <p className="act__when">
          {agoLabel(dayOf(new Date(item.at)), today)}
          {episode && ` · ${episodeLabel(episode.seasonNumber, episode.episodeNumber)}`}
        </p>
        {item.kind === "review" && <p className="act__quote">“{item.body}”</p>}
      </div>
      <Thumb title={item.title} decorative />
    </li>
  );
}

/** What the people the viewer follows did lately, or the way to find people to follow. */
function FromFollowing({ summary }: { summary: HomeSummary }) {
  const { activity, followingCount, today } = summary;
  if (activity.length === 0) {
    return (
      <div>
        <SectionHead title="From people you follow" />
        <div className="empty">
          <p>
            {followingCount > 0
              ? "The people you follow have not added or reviewed anything you can see yet."
              : "Follow people to see what they are watching, playing, and reading."}
          </p>
          <div className="mt-4 flex justify-center">
            <Link className="btn btn--soft btn--sm" href="/feed">
              <Icon name="feed" size="sm" />
              {followingCount > 0 ? "Find more people" : "Find people to follow"}
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <SectionHead title="From people you follow" more={{ href: "/feed", label: "Feed" }} />
      <ul>
        {activity.map((item) => (
          <Activity key={`${item.kind}:${item.id}`} item={item} today={today} />
        ))}
      </ul>
    </div>
  );
}

const threadLayout: CSSProperties = {
  gridTemplateColumns: "minmax(0, 1fr) auto",
  padding: "14px 4px",
};

function ClubDiscussions({ summary }: { summary: HomeSummary }) {
  const { discussions, today } = summary;
  return (
    <>
      <SectionHead title="In your clubs" more={{ href: "/clubs", label: "Clubs" }} />
      <ul>
        {discussions.map((thread) => (
          <li key={thread.id}>
            <Link
              className="thread"
              href={discussionPath(thread.club.id, thread.id)}
              style={threadLayout}
            >
              <div>
                <div className="thread__t">{thread.title}</div>
                <div className="thread__s">
                  {thread.club.name} · {thread.replyCount > 0 ? "last reply" : "started"}{" "}
                  {midSentence(agoLabel(dayOf(new Date(thread.activeAt)), today))}
                </div>
              </div>
              <span className="thread__n">
                <Icon name="msg" size="sm" />
                {thread.replyCount}
                <span className="sr-only">{thread.replyCount === 1 ? " reply" : " replies"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The part of Home that is about other people: what those the viewer follows did, beside the
 * viewer's own alerts that came through and their clubs' latest discussions. With nothing for
 * the second column, the first stands alone.
 */
export function Together({ summary }: { summary: HomeSummary }) {
  const { cameThrough, discussions } = summary;
  const hasAlerts = cameThrough.length > 0;
  const hasDiscussions = discussions.length > 0;

  if (!hasAlerts && !hasDiscussions) {
    return (
      <section className="section">
        <FromFollowing summary={summary} />
      </section>
    );
  }
  return (
    <section className="section duo">
      <FromFollowing summary={summary} />
      <div>
        {hasAlerts && (
          <>
            <SectionHead
              title="Alerts that came through"
              more={{ href: "/alerts", label: "All alerts" }}
            />
            {cameThrough.map((alert) => (
              <CameCard
                key={alert.id}
                alert={{
                  ...alert,
                  triggeredAt: alert.triggeredAt ? new Date(alert.triggeredAt) : null,
                }}
              />
            ))}
          </>
        )}
        {hasDiscussions && (
          <div style={hasAlerts ? { marginTop: 36 } : undefined}>
            <ClubDiscussions summary={summary} />
          </div>
        )}
      </div>
    </section>
  );
}

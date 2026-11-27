import { imageAt } from "@yousiverse/integrations/images";
import { cn } from "cn";
import Link from "next/link";
import { Fragment } from "react";
import { Artwork } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Meter } from "@/components/media/score";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { daysBetween, shortDate, usToday } from "@/lib/days";
import { pluralize } from "@/lib/format";
import { LIBRARY_STATUSES, type LibraryEntry, STATUS_ICONS, statusLabel } from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { type TitleArt, tonedClass, toneStyle } from "@/lib/titles";
import { universePath } from "@/lib/universes";
import type { FollowedRating } from "./friends-panel";
import { ProgressLine } from "./progress";
import { StatusControl } from "./status-control";

/** What the day a title comes out is called, for each medium. */
const RELEASE_LABELS: Record<MediaType, string> = {
  movie: "In theaters",
  tv: "Premieres",
  game: "Out",
  book: "Out",
};

type Props = {
  title: TitleArt & { mediaId: string };
  /** What follows the medium in the line over the name: years, length, genres. */
  meta: string[];
  /** Who made it, for a book or a game. Shown in place of a tagline. */
  by: string | null;
  tagline: string | null;
  /** The day it comes out, for a title that is not out yet. */
  comingOn: string | null;
  /** Everyone's ratings: the average in quarter points, or null when there are none. */
  average: number | null;
  ratingCount: number;
  /** What the people the viewer follows rated it, highest first. */
  followed: FollowedRating[];
  universe: { id: string; name: string } | null;
  /** The viewer's library entry, or null when the title is not in their library. */
  entry: LibraryEntry | null;
  /** Where a visitor signs in to come back here. Null for someone who is signed in. */
  signInHref: string | null;
};

/**
 * The top of a title's page: its backdrop, its artwork in its own shape, its name, and the
 * status control. A title with no backdrop gets a plain hero lit by its blurred poster.
 */
export function Hero({
  title,
  meta,
  by,
  tagline,
  comingOn,
  average,
  ratingCount,
  followed,
  universe,
  entry,
  signInHref,
}: Props) {
  const isShow = title.type === "tv";
  const behind = title.backdropUrl ?? title.posterUrl;

  return (
    <header
      className={cn("hero night", tonedClass(title), !title.backdropUrl && "hero--plain")}
      style={toneStyle(title)}
    >
      <div className="hero__bg">
        {behind && (
          // biome-ignore lint/performance/noImgElement: provider CDNs already serve sized images, so Next's optimizer would only add cost.
          <img src={imageAt(behind, title.backdropUrl ? "large" : "medium")} alt="" />
        )}
      </div>
      <div className={cn("hero__in", isShow && "hero__in--solo")}>
        {!isShow && (
          <Artwork title={title} size="large" link={false} priority arrives className="hero__art" />
        )}
        <div className="min-w-0">
          <div className="hero__meta">
            <Medium type={title.type} />
            {meta.map((item) => (
              <Fragment key={item}>
                <span className="sep" />
                {item}
              </Fragment>
            ))}
          </div>
          <h1 className={cn("d1", title.title.length > 26 && "long")}>{title.title}</h1>
          {by ? (
            <p className="hero__by">by {by}</p>
          ) : (
            tagline && <p className="hero__tag">{tagline}</p>
          )}
          <div className="hero__actions">
            {signInHref ? (
              <SignedOutStatus type={title.type} signInHref={signInHref} />
            ) : (
              <StatusControl
                mediaId={title.mediaId}
                type={title.type}
                title={title.title}
                entry={entry && { status: entry.status, visibility: entry.visibility }}
              />
            )}
          </div>
          {entry && <ProgressLine title={title} entry={entry} />}
          <Stats
            type={title.type}
            comingOn={comingOn}
            average={average}
            ratingCount={ratingCount}
            followed={followed}
            universe={universe}
          />
        </div>
      </div>
    </header>
  );
}

/** The status control as a visitor sees it: every choice leads to signing in, then back here. */
function SignedOutStatus({ type, signInHref }: { type: MediaType; signInHref: string }) {
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot be laid out as this strip. */}
      <div className="status" role="group" aria-label="Add to your library">
        {LIBRARY_STATUSES.map((status) => (
          <Link key={status} href={signInHref}>
            <Icon name={STATUS_ICONS[status]} />
            {statusLabel(status, type)}
          </Link>
        ))}
      </div>
      <p className="hint">
        <Link className="link" href={signInHref}>
          Sign in
        </Link>{" "}
        to add this to your library or a list, and rate it.
      </p>
    </>
  );
}

type StatsProps = Pick<Props, "comingOn" | "average" | "ratingCount" | "followed" | "universe"> & {
  type: MediaType;
};

/** The figures under the controls: the average or the wait, who rated it, and its universe. */
function Stats({ type, comingOn, average, ratingCount, followed, universe }: StatsProps) {
  if (!comingOn && average === null && followed.length === 0 && !universe) return null;
  return (
    <div className="hero__stats">
      {comingOn ? (
        <>
          <div className="stat">
            <span className="label">{RELEASE_LABELS[type]}</span>
            <b>{shortDate(comingOn)}</b>
          </div>
          <div className="stat">
            <span className="label">Countdown</span>
            <b>{pluralize(daysBetween(usToday(), comingOn), "day")}</b>
          </div>
        </>
      ) : (
        average !== null && (
          <div className="stat">
            <span className="label">Everyone</span>
            <b>
              <Meter value={(average / 40) * 100} />
              {(average / 4).toFixed(1)}
              <span className="sr-only"> out of 10, from {pluralize(ratingCount, "rating")}</span>
            </b>
          </div>
        )
      )}
      {followed.length > 0 && (
        <div className="stat">
          <span className="label">People you follow</span>
          <b>
            <span className="avs">
              {followed.slice(0, 4).map(({ username }) => (
                <Avatar key={username} username={username} size={26} />
              ))}
            </span>
            <span className="sr-only">{pluralize(followed.length, "rating")}</span>
          </b>
        </div>
      )}
      {universe && (
        <Link className="stat" href={universePath(universe.id)}>
          <span className="label">Universe</span>
          <b>
            <Icon name="orbit" size="lg" />
            {universe.name}
          </b>
        </Link>
      )}
    </div>
  );
}

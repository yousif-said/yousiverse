import { cn } from "cn";
import Link from "next/link";
import type { CSSProperties } from "react";
import { shortDate } from "@/lib/days";
import { formatRating } from "@/lib/format";
import { hasAired } from "./episodes-season";

type Episode = { id: string; episodeNumber: number; name: string; airDate: string | null };
type Rating = { average: number | null; mine: number | null };

type Props = {
  /** The show's own page; episode pages sit under it. */
  showPath: string;
  seasons: { seasonNumber: number; episodes: Episode[] }[];
  /** Everyone's average and the viewer's own rating, in quarter points, by episode id. */
  ratings: Map<string, Rating>;
  /** Today in the US, to tell an episode that has aired from one that has not. */
  today: string;
  signedIn: boolean;
};

// The two ends of the scale, out of 10. Most episodes of most shows average between them, so
// the whole ramp gets used; anything outside takes the nearest end.
const DARKEST_AT = 7.2;
const BRIGHTEST_AT = 9.6;
// Past this share of the ramp a cell is light enough to need dark numbers.
const DARK_TEXT_ABOVE = 0.52;

type CellProps = {
  href: string;
  /** "Season 2, episode 4" or "Special 1": which episode this is, for screen readers. */
  place: string;
  episode: Episode;
  rating: Rating | undefined;
  aired: boolean;
};

function Cell({ href, place, episode, rating, aired }: CellProps) {
  const average = rating?.average == null ? null : rating.average / 4;
  const mine = rating?.mine ?? null;
  const strength =
    average === null
      ? 0
      : Math.min(1, Math.max(0, (average - DARKEST_AT) / (BRIGHTEST_AT - DARKEST_AT)));
  const says =
    average !== null
      ? `${episode.name}: everyone ${average.toFixed(1)}${mine === null ? "" : `, you ${formatRating(mine)}`}`
      : aired
        ? `${episode.name}: no ratings yet`
        : `${episode.name}, ${episode.airDate ? shortDate(episode.airDate) : "date to be announced"}`;

  return (
    <Link
      className={cn(
        "heat__cell",
        average === null && "none",
        strength > DARK_TEXT_ABOVE && "hi",
        mine !== null && "mine",
      )}
      style={{ "--q": strength.toFixed(2) } as CSSProperties}
      href={href}
      title={says}
      aria-label={`${place}, ${says}`}
      prefetch={false}
    >
      {average !== null ? average.toFixed(1) : aired ? "–" : "·"}
    </Link>
  );
}

/**
 * Every episode's average as a grid, one row per season, so a show's high and low points can
 * be seen at a glance. Each cell is a link to its episode and says in words what it shows.
 */
export function Heatmap({ showPath, seasons, ratings, today, signedIn }: Props) {
  const columns = Math.max(...seasons.map((season) => season.episodes.length));

  return (
    <>
      <div className="heat" style={{ "--cols": columns } as CSSProperties}>
        <div className="heat__row heat__head" aria-hidden="true">
          <span />
          {Array.from({ length: columns }, (_, index) => index + 1).map((number) => (
            <span key={number} style={{ textAlign: "center" }}>
              {number}
            </span>
          ))}
        </div>
        {seasons.map(({ seasonNumber, episodes }) => (
          <div key={seasonNumber} className="heat__row">
            <span>{seasonNumber === 0 ? "SP" : `S${seasonNumber}`}</span>
            {episodes.map((episode) => (
              <Cell
                key={episode.id}
                href={`${showPath}/seasons/${seasonNumber}/episodes/${episode.episodeNumber}`}
                place={
                  seasonNumber === 0
                    ? `Special ${episode.episodeNumber}`
                    : `Season ${seasonNumber}, episode ${episode.episodeNumber}`
                }
                episode={episode}
                rating={ratings.get(episode.id)}
                aired={hasAired(episode, today)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heat__key">
        <span>Lower</span>
        <i aria-hidden="true" />
        <span>Higher</span>
        <span style={{ marginLeft: 14 }}>
          Everyone's average for each episode.
          {signedIn && " A white underline marks the ones you rated."}
        </span>
      </div>
    </>
  );
}

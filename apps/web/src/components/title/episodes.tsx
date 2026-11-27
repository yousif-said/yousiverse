import { imageAt } from "@yousiverse/integrations/images";
import Link from "next/link";
import { Average, Score } from "@/components/media/score";
import { LinkSegmented } from "@/components/ui/link-tabs";
import { SectionHead } from "@/components/ui/section-head";
import { untilLabel, usToday } from "@/lib/days";
import { formatDate, formatRuntime, pluralize } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { hasAired, openingSeason, seasonsToShow } from "./episodes-season";
import { WatchedTick } from "./episodes-watched";
import { Heatmap } from "./heatmap";

type Props = {
  show: { mediaId: string; providerId: string; title: string };
  /** The season to open on. Defaults to the one the viewer is in, or the latest. */
  season?: number;
  /** Where the season picker leads: back to the show's page, or to each season's own page. */
  linkTo?: "show" | "season";
};

// A grid of more rows than this stops being something to take in at a glance.
const MOST_SEASONS_IN_HEATMAP = 12;

const seasonLabel = (seasonNumber: number) =>
  seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;

/** A show's episodes: every episode's average as a heatmap, then one season as a list. */
export async function Episodes({ show, season, linkTo = "show" }: Props) {
  const queryClient = getQueryClient();
  const { mediaId } = show;
  const session = await getSession();
  const [stored, ratings, watchedIds, entry] = await Promise.all([
    queryClient.fetchQuery(trpc.media.episodes.queryOptions({ mediaId })),
    queryClient.fetchQuery(trpc.ratings.forShow.queryOptions({ mediaId })),
    session ? queryClient.fetchQuery(trpc.library.watchedEpisodes.queryOptions({ mediaId })) : [],
    session ? queryClient.fetchQuery(trpc.library.entry.queryOptions({ mediaId })) : null,
  ]);

  const today = usToday();
  const seasons = seasonsToShow(stored, season);
  const selected = openingSeason(seasons, {
    asked: season,
    upTo: entry?.progress?.kind === "episodes" ? entry.progress.next?.seasonNumber : undefined,
    today,
  });
  if (!selected) return null;

  const showPath = mediaPath("tv", show.providerId);
  const seasonPath = (seasonNumber: number) =>
    linkTo === "show"
      ? `${showPath}?season=${seasonNumber}`
      : `${showPath}/seasons/${seasonNumber}`;
  const ratingOf = new Map(ratings.map((rating) => [rating.episodeId, rating]));
  const watched = new Set(watchedIds);
  const charted = seasons.filter(({ episodes }) => episodes.length > 0);
  const counted = charted.filter(({ seasonNumber }) => seasonNumber > 0);
  const episodeCount = counted.reduce((count, { episodes }) => count + episodes.length, 0);
  const hasStills = selected.episodes.some((episode) => episode.stillUrl);

  return (
    <section aria-labelledby="episodes-h">
      <SectionHead
        title="Episodes"
        id="episodes-h"
        sub={`${pluralize(counted.length, "season")}, ${pluralize(episodeCount, "episode")}`}
      />

      {charted.length > 0 && charted.length <= MOST_SEASONS_IN_HEATMAP && (
        <Heatmap
          showPath={showPath}
          seasons={charted}
          ratings={ratingOf}
          today={today}
          signedIn={session !== null}
        />
      )}

      <div className="toolbar" style={{ margin: "28px 0 6px" }}>
        <LinkSegmented
          label="Season"
          small
          choices={seasons.map(({ seasonNumber }) => ({
            href: seasonPath(seasonNumber),
            label: seasonLabel(seasonNumber),
            current: seasonNumber === selected.seasonNumber,
          }))}
        />
      </div>

      {selected.episodes.length === 0 ? (
        <p className="empty">No episodes have been announced yet.</p>
      ) : (
        <ol className="eps">
          {selected.episodes.map((episode) => {
            const { episodeNumber } = episode;
            const href = `${showPath}/seasons/${selected.seasonNumber}/episodes/${episodeNumber}`;
            const rating = ratingOf.get(episode.id);
            const out = hasAired(episode, today);
            return (
              <li
                key={episode.id}
                className="ep"
                style={hasStills ? undefined : { gridTemplateColumns: "30px minmax(0,1fr) auto" }}
              >
                <span className="ep__n" aria-hidden="true">
                  {episodeNumber}
                </span>
                {hasStills && (
                  <Link
                    className="ep__still"
                    href={href}
                    tabIndex={-1}
                    aria-hidden="true"
                    prefetch={false}
                  >
                    {episode.stillUrl && (
                      // biome-ignore lint/performance/noImgElement: the provider's CDN already serves sized images, so Next's optimizer would only add cost.
                      <img src={imageAt(episode.stillUrl, "medium")} alt="" loading="lazy" />
                    )}
                  </Link>
                )}
                <div className="min-w-0">
                  <h3>
                    <Link className="ep__name" href={href}>
                      <span className="sr-only">Episode {episodeNumber}: </span>
                      {episode.name}
                    </Link>
                  </h3>
                  <div className="ep__sub">
                    <span>
                      {episode.airDate ? formatDate(episode.airDate) : "Date to be announced"}
                    </span>
                    {episode.runtimeMinutes !== null && episode.runtimeMinutes > 0 && (
                      <span>{formatRuntime(episode.runtimeMinutes)}</span>
                    )}
                    {out && <Average value={rating?.average} />}
                  </div>
                  {episode.overview && <p className="ep__text">{episode.overview}</p>}
                </div>
                <div className="ep__end">
                  {rating?.mine != null ? (
                    <Score value={rating.mine} large />
                  ) : out ? (
                    session && (
                      <Link className="btn btn--sm btn--ghost" href={href} prefetch={false}>
                        Rate<span className="sr-only"> episode {episodeNumber}</span>
                      </Link>
                    )
                  ) : (
                    <span className="chip chip--line">
                      {episode.airDate ? untilLabel(episode.airDate, today) : "To be announced"}
                    </span>
                  )}
                  {out && session && (
                    <WatchedTick
                      episodeId={episode.id}
                      episodeNumber={episodeNumber}
                      watched={watched.has(episode.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

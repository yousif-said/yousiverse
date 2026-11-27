import { imageAt } from "@yousiverse/integrations/images";
import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WatchedButton } from "@/components/title/episodes-watched";
import { RatingDial } from "@/components/title/rating-dial";
import { Reviews } from "@/components/title/reviews";
import { Ambient } from "@/components/ui/ambient";
import { Icon } from "@/components/ui/icon";
import { Crumb } from "@/components/ui/page-header";
import { midSentence, untilLabel, usToday } from "@/lib/days";
import { formatDate, formatRuntime } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { tonedClass, toneStyle } from "@/lib/titles";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/tv/[id]/seasons/[number]/episodes/[episode]">;

async function getEpisode(params: Props["params"]) {
  const { id, number, episode } = await params;
  if (!/^\d{1,5}$/.test(number) || !/^\d{1,5}$/.test(episode)) notFound();
  return orNotFound(
    getQueryClient().fetchQuery(
      trpc.media.episode.queryOptions({
        providerId: id,
        seasonNumber: Number(number),
        episodeNumber: Number(episode),
      }),
    ),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const episode = await getEpisode(params);
  return { title: `${episode.show.title}: ${episode.name}`, description: episode.overview };
}

export default async function EpisodePage({ params }: Props) {
  const episode = await getEpisode(params);
  const { show, season } = episode;
  const showPath = mediaPath("tv", show.providerId);
  const episodePath = (number: number) =>
    `${showPath}/seasons/${season.seasonNumber}/episodes/${number}`;
  const target = { episodeId: episode.id };
  const aired = episode.airDate !== null && episode.airDate <= usToday();
  const picture = episode.stillUrl ?? show.backdropUrl;

  const session = await getSession();
  const watched =
    session && aired
      ? await getQueryClient().fetchQuery(
          trpc.library.watchedEpisodes.queryOptions({ mediaId: show.mediaId }),
        )
      : null;

  return (
    <>
      <Ambient src={picture} />
      <div className={cn("page page--narrow", tonedClass(show))} style={toneStyle(show)}>
        <Crumb href={showPath}>{show.title}</Crumb>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gap: 28,
            marginTop: 18,
          }}
        >
          {picture && (
            <div className="art art--tv" style={{ aspectRatio: "21/9", borderRadius: 22 }}>
              {/* biome-ignore lint/performance/noImgElement: the provider's CDN already serves sized images, so Next's optimizer would only add cost. */}
              <img src={imageAt(picture, "large", "wide")} alt="" />
            </div>
          )}
          <div className="ph" style={{ margin: 0 }}>
            <div className="ph__text">
              <span className="label">
                {season.seasonNumber === 0
                  ? `Special ${episode.episodeNumber}`
                  : `Season ${season.seasonNumber}, episode ${episode.episodeNumber}`}
              </span>
              <h1 className="d2">{episode.name}</h1>
              <p className="dim">
                {[
                  episode.airDate ? formatDate(episode.airDate) : "Date to be announced",
                  episode.runtimeMinutes ? formatRuntime(episode.runtimeMinutes) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {watched && (
              <div className="ph__actions">
                <WatchedButton
                  episodeId={episode.id}
                  episodeNumber={episode.episodeNumber}
                  watched={watched.includes(episode.id)}
                />
              </div>
            )}
          </div>

          {aired ? (
            <RatingDial target={target} friends={false} />
          ) : (
            <div className="note">
              <Icon name="clock" />
              <span>
                {episode.airDate
                  ? `This episode airs ${midSentence(untilLabel(episode.airDate))}.`
                  : "This episode has no air date yet."}{" "}
                You can rate it once it is out.
              </span>
            </div>
          )}

          {episode.overview && <p className="prose">{episode.overview}</p>}

          <nav
            aria-label="Episodes either side of this one"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 20,
              borderTop: "1px solid var(--line)",
            }}
          >
            {episode.previous === null ? (
              <span />
            ) : (
              <Link className="btn btn--soft" href={episodePath(episode.previous)}>
                <Icon name="chev-l" size="sm" />
                Episode {episode.previous}
              </Link>
            )}
            {episode.next !== null && (
              <Link className="btn btn--soft" href={episodePath(episode.next)}>
                Episode {episode.next}
                <Icon name="chev-r" size="sm" />
              </Link>
            )}
          </nav>

          {aired && (
            <Reviews
              target={target}
              heading="Reviews of this episode"
              hint="Episode reviews are separate from the show's."
            />
          )}
        </div>
      </div>
    </>
  );
}

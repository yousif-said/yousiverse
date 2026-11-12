import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RatingPanel } from "@/components/rating-panel";
import { ReviewSection } from "@/components/review-section";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { formatDate, formatRuntime } from "@/lib/format";
import { MEDIA, mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/tv/[id]/seasons/[number]/episodes/[episode]">;

const linkClasses =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
  const { id } = await params;
  const seasonPath = `${mediaPath("tv", id)}/seasons/${episode.season.seasonNumber}`;
  const path = `${seasonPath}/episodes/${episode.episodeNumber}`;
  const target = { episodeId: episode.id };

  return (
    <article className="max-w-3xl pt-10 sm:pt-16">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-x-2">
        <Link href={mediaPath("tv", id)} className={linkClasses}>
          {episode.show.title}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <Link href={seasonPath} className={linkClasses}>
          {episode.season.name}
        </Link>
      </nav>
      <h1 className="mt-2 font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
        {episode.name}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {[
          `Episode ${episode.episodeNumber}`,
          episode.airDate && formatDate(episode.airDate),
          episode.runtimeMinutes && formatRuntime(episode.runtimeMinutes),
        ]
          .filter(Boolean)
          .join(", ")}
      </p>
      {episode.overview && (
        <p className="mt-6 max-w-[65ch] text-pretty leading-relaxed">{episode.overview}</p>
      )}

      <div className="mt-8 max-w-xl space-y-2 border-t pt-6">
        <RatingPanel target={target} accent={MEDIA.tv.accent} />
        {!(await getSession()) && (
          <SignInPrompt returnTo={path}>to rate this episode.</SignInPrompt>
        )}
      </div>

      <ReviewSection target={target} path={path} />
    </article>
  );
}

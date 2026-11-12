import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeRating } from "@/components/episode-rating";
import { formatAverageRating, formatDate, formatRuntime, pluralize } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/tv/[id]/seasons/[number]">;

async function getSeason(params: Props["params"]) {
  const { id, number } = await params;
  if (!/^\d{1,5}$/.test(number)) notFound();
  return orNotFound(
    getQueryClient().fetchQuery(
      trpc.media.season.queryOptions({ providerId: id, seasonNumber: Number(number) }),
    ),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const season = await getSeason(params);
  return { title: `${season.show.title}: ${season.name}`, description: season.overview };
}

export default async function SeasonPage({ params }: Props) {
  const season = await getSeason(params);
  const { id } = await params;
  const [session, ratings] = await Promise.all([
    getSession(),
    getQueryClient().fetchQuery(trpc.ratings.forSeason.queryOptions({ seasonId: season.id })),
  ]);
  const ratingOf = new Map(ratings.map((rating) => [rating.episodeId, rating]));

  return (
    <article className="max-w-3xl pt-10 sm:pt-16">
      <Link
        href={mediaPath("tv", id)}
        className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {season.show.title}
      </Link>
      <h1 className="mt-2 font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
        {season.name}
      </h1>
      {season.overview && (
        <p className="mt-6 max-w-[65ch] text-pretty leading-relaxed">{season.overview}</p>
      )}

      {season.episodes.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No episodes have been announced yet.</p>
      ) : (
        <ol className="mt-10 divide-y border-y">
          {season.episodes.map((episode) => {
            const rating = ratingOf.get(episode.id);
            return (
              <li key={episode.id} className="grid grid-cols-[2.5rem_1fr_auto] gap-x-4 py-5">
                <span
                  aria-hidden="true"
                  className="font-display text-2xl leading-none font-bold text-muted-foreground tabular-nums"
                >
                  {episode.episodeNumber}
                </span>
                <div className="min-w-0">
                  <h2 className="font-medium">
                    <span className="sr-only">Episode {episode.episodeNumber}: </span>
                    {episode.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {[
                      episode.airDate && formatDate(episode.airDate),
                      episode.runtimeMinutes && formatRuntime(episode.runtimeMinutes),
                      rating?.average != null &&
                        `average ${formatAverageRating(rating.average)} from ${pluralize(rating.count, "rating")}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {episode.overview && (
                    <p className="mt-2 max-w-[65ch] text-pretty text-sm leading-relaxed">
                      {episode.overview}
                    </p>
                  )}
                </div>
                {session && (
                  <EpisodeRating
                    episodeId={episode.id}
                    episodeNumber={episode.episodeNumber}
                    mine={rating?.mine ?? null}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

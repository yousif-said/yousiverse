import type { Metadata } from "next";
import Link from "next/link";
import { MediaHeader } from "@/components/media-header";
import { formatDate, pluralize } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

function getTvShow(providerId: string) {
  return orNotFound(getQueryClient().fetchQuery(trpc.media.tvShow.queryOptions({ providerId })));
}

export async function generateMetadata({ params }: PageProps<"/tv/[id]">): Promise<Metadata> {
  const show = await getTvShow((await params).id);
  return { title: show.title, description: show.overview };
}

export default async function TvShowPage({ params }: PageProps<"/tv/[id]">) {
  const { id } = await params;
  const show = await getTvShow(id);

  return (
    <>
      <MediaHeader
        mediaId={show.id}
        providerId={id}
        type="tv"
        title={show.title}
        tagline={show.tagline}
        overview={show.overview}
        posterUrl={show.posterUrl}
        facts={[
          { label: "First aired", value: show.releaseDate && formatDate(show.releaseDate) },
          { label: "Status", value: show.status },
          { label: "Genres", value: show.genres.join(", ") },
        ]}
      />

      {show.seasons.length > 0 && (
        <section aria-labelledby="seasons-heading" className="mt-16 max-w-3xl">
          <h2 id="seasons-heading" className="font-display text-2xl font-bold tracking-tight">
            Seasons
          </h2>
          <ul className="mt-4 divide-y border-y">
            {show.seasons.map((season) => (
              <li key={season.seasonNumber}>
                <Link
                  href={`${mediaPath("tv", id)}/seasons/${season.seasonNumber}`}
                  className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{season.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {season.airDate && `${season.airDate.slice(0, 4)}, `}
                    {pluralize(season.episodeCount, "episode")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

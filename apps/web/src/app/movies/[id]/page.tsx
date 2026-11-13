import type { Metadata } from "next";
import { MediaHeader } from "@/components/media-header";
import { ReviewSection } from "@/components/review-section";
import { WhereToWatch } from "@/components/where-to-watch";
import { formatDate, formatRuntime } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

function getMovie(providerId: string) {
  return orNotFound(getQueryClient().fetchQuery(trpc.media.movie.queryOptions({ providerId })));
}

export async function generateMetadata({ params }: PageProps<"/movies/[id]">): Promise<Metadata> {
  const movie = await getMovie((await params).id);
  return { title: movie.title, description: movie.overview };
}

export default async function MoviePage({ params }: PageProps<"/movies/[id]">) {
  const { id } = await params;
  const movie = await getMovie(id);

  return (
    <>
      <MediaHeader
        mediaId={movie.id}
        providerId={id}
        type="movie"
        title={movie.title}
        tagline={movie.tagline}
        overview={movie.overview}
        posterUrl={movie.posterUrl}
        facts={[
          { label: "Released", value: movie.releaseDate && formatDate(movie.releaseDate) },
          {
            label: "Runtime",
            value: movie.runtimeMinutes ? formatRuntime(movie.runtimeMinutes) : null,
          },
          { label: "Genres", value: movie.genres.join(", ") },
        ]}
      />
      <WhereToWatch mediaId={movie.id} type="movie" />
      <ReviewSection target={{ mediaId: movie.id }} path={mediaPath("movie", id)} />
    </>
  );
}

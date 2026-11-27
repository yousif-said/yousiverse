import type { Metadata } from "next";
import { NO_DATE, TitlePage } from "@/components/title/title-page";
import { formatDate, formatRuntime } from "@/lib/format";
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
  const runtime = movie.runtimeMinutes ? formatRuntime(movie.runtimeMinutes) : null;

  return (
    <TitlePage
      title={{ ...movie, mediaId: movie.id, type: "movie", providerId: id }}
      meta={[movie.releaseYear ?? NO_DATE, runtime, movie.genres.slice(0, 2).join(", ")]}
      tagline={movie.tagline}
      facts={[
        { label: "Released", value: movie.releaseDate && formatDate(movie.releaseDate) },
        { label: "Runtime", value: runtime },
        { label: "Genres", value: movie.genres.join(", ") },
      ]}
    />
  );
}

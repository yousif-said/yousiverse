import type { Metadata } from "next";
import { NO_DATE, TitlePage } from "@/components/title/title-page";
import { usToday } from "@/lib/days";
import { formatDate, pluralize } from "@/lib/format";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

/** What TMDB calls a show that will make no more episodes. */
const OVER = ["Ended", "Canceled"];

function getTvShow(providerId: string) {
  return orNotFound(getQueryClient().fetchQuery(trpc.media.tvShow.queryOptions({ providerId })));
}

export async function generateMetadata({ params }: PageProps<"/tv/[id]">): Promise<Metadata> {
  const show = await getTvShow((await params).id);
  return { title: show.title, description: show.overview };
}

export default async function TvShowPage({ params, searchParams }: PageProps<"/tv/[id]">) {
  const [{ id }, { season }] = await Promise.all([params, searchParams]);
  const show = await getTvShow(id);
  // Specials (season 0) do not count as a season.
  const seasonCount = show.seasons.filter((each) => each.seasonNumber > 0).length;
  const running =
    !OVER.includes(show.status ?? "") && show.releaseDate !== null && show.releaseDate <= usToday();

  return (
    <TitlePage
      title={{ ...show, mediaId: show.id, type: "tv", providerId: id }}
      meta={[
        show.releaseYear ? `${show.releaseYear}${running ? " to now" : ""}` : NO_DATE,
        seasonCount > 0 && pluralize(seasonCount, "season"),
        show.genres.slice(0, 2).join(", "),
      ]}
      tagline={show.tagline}
      facts={[
        { label: "First aired", value: show.releaseDate && formatDate(show.releaseDate) },
        { label: "Status", value: show.status?.replace("Returning Series", "Returning") },
        { label: "Seasons", value: seasonCount },
        { label: "Genres", value: show.genres.join(", ") },
      ]}
      season={typeof season === "string" && /^\d{1,4}$/.test(season) ? Number(season) : undefined}
    />
  );
}

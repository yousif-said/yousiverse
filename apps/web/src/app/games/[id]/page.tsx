import type { Metadata } from "next";
import { NO_DATE, TitlePage } from "@/components/title/title-page";
import { formatDate } from "@/lib/format";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

function getGame(providerId: string) {
  return orNotFound(getQueryClient().fetchQuery(trpc.media.game.queryOptions({ providerId })));
}

export async function generateMetadata({ params }: PageProps<"/games/[id]">): Promise<Metadata> {
  const game = await getGame((await params).id);
  return { title: game.title, description: game.overview };
}

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const game = await getGame(id);

  return (
    <TitlePage
      title={{ ...game, mediaId: game.id, type: "game", providerId: id }}
      meta={[
        game.releaseYear ?? NO_DATE,
        game.platforms.slice(0, 4).join(", "),
        game.genres.slice(0, 2).join(", "),
      ]}
      by={game.developers.join(" and ")}
      facts={[
        { label: "Released", value: game.releaseDate && formatDate(game.releaseDate) },
        { label: "Developer", value: game.developers.join(", ") },
        { label: "Publisher", value: game.publishers.join(", ") },
        { label: "Platforms", value: game.platforms.join(", ") },
        { label: "Genres", value: game.genres.join(", ") },
      ]}
    />
  );
}

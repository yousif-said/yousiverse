import type { Metadata } from "next";
import { MediaHeader } from "@/components/media-header";
import { ReviewSection } from "@/components/review-section";
import { WhereToBuy } from "@/components/where-to-buy";
import { formatDate } from "@/lib/format";
import { mediaPath } from "@/lib/media";
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
    <>
      <MediaHeader
        mediaId={game.id}
        providerId={id}
        type="game"
        title={game.title}
        tagline={null}
        overview={game.overview}
        posterUrl={game.posterUrl}
        facts={[
          { label: "Released", value: game.releaseDate && formatDate(game.releaseDate) },
          { label: "Developer", value: game.developers.join(", ") },
          { label: "Publisher", value: game.publishers.join(", ") },
          { label: "Platforms", value: game.platforms.join(", ") },
          { label: "Genres", value: game.genres.join(", ") },
        ]}
      />
      <WhereToBuy mediaId={game.id} />
      <ReviewSection target={{ mediaId: game.id }} path={mediaPath("game", id)} />
    </>
  );
}

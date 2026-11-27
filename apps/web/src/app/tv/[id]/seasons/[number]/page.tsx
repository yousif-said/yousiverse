import { cn } from "cn";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Episodes } from "@/components/title/episodes";
import { Ambient } from "@/components/ui/ambient";
import { Crumb, PageHeader } from "@/components/ui/page-header";
import { mediaPath } from "@/lib/media";
import { ambientOf, tonedClass, toneStyle } from "@/lib/titles";
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

/** One season at its own address: the show's episodes section, opened on this season. */
export default async function SeasonPage({ params }: Props) {
  const { show, ...season } = await getSeason(params);

  return (
    <>
      <Ambient src={ambientOf(show)} />
      <div className={cn("page page--narrow", tonedClass(show))} style={toneStyle(show)}>
        <Crumb href={mediaPath("tv", show.providerId)}>{show.title}</Crumb>
        <PageHeader title={season.name} lede={season.overview} className="mt-[18px]" />
        <Episodes show={show} season={season.seasonNumber} linkTo="season" />
      </div>
    </>
  );
}

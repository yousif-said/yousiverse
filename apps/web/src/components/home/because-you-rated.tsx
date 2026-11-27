import { Shelf, TitleCard } from "@/components/media/title-card";
import { SectionHead } from "@/components/ui/section-head";
import { formatRating } from "@/lib/format";
import { getQueryClient, trpc } from "@/trpc/server";

/**
 * One row of recommendations, from the title the person rated highest. Rendered inside a
 * `Suspense` boundary: the first time, similar titles are fetched from a provider, and the rest
 * of Home should not wait for that.
 */
export async function BecauseYouRated() {
  const { rows } = await getQueryClient().fetchQuery(trpc.recommendations.forYou.queryOptions());
  const [row] = rows;
  if (!row) return null;

  return (
    <section className="section" aria-labelledby="rec-h">
      <SectionHead
        id="rec-h"
        title={`Because you rated ${row.seed.title} ${formatRating(row.seed.rating)}`}
        more={{ href: "/recommendations", label: "For you" }}
      />
      <Shelf>
        {row.titles.map((title) => (
          <TitleCard key={`${title.type}:${title.providerId}`} title={title} />
        ))}
      </Shelf>
    </section>
  );
}

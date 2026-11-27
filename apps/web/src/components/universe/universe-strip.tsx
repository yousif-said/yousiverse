import { TitleCard } from "@/components/media/title-card";
import { SectionHead } from "@/components/ui/section-head";
import { pluralize } from "@/lib/format";
import { relationTo, universePath, universeProgress, universeTitle } from "@/lib/links";
import { getMarks } from "@/lib/marks";
import { getSession } from "@/lib/session";
import { getUniverseOf } from "@/lib/universes";
import { getQueryClient, trpc } from "@/trpc/server";

/**
 * The universe a title belongs to, as a strip along its page: every linked title in release
 * order, each with what it is to this one. Renders nothing for a title that stands alone.
 */
export async function UniverseStrip({ mediaId }: { mediaId: string }) {
  // Most titles stand alone, and the page has usually asked this already for its hero.
  const found = await getUniverseOf(mediaId);
  if (!found) return null;

  const [universe, session] = await Promise.all([
    getQueryClient().fetchQuery(trpc.links.universe.queryOptions({ id: found.id })),
    getSession(),
  ]);
  const { titles, links } = universe;
  const { status } = await getMarks(titles.map((title) => title.mediaId));
  const mediums = new Set(titles.map((title) => title.type)).size;
  const summary = `${pluralize(titles.length, "title")} across ${pluralize(mediums, "medium", "mediums")}.`;

  return (
    <section aria-labelledby="universe-h">
      <SectionHead
        id="universe-h"
        title={universeTitle(universe.name)}
        sub={
          session
            ? `${summary} You have finished ${universeProgress(titles, status).finished}.`
            : summary
        }
        more={{ label: "See the map", href: universePath(universe.id) }}
      />
      {/* biome-ignore lint/a11y/useSemanticElements: the design system styles this strip as nested blocks, and it is a list to read. */}
      <div className="uni toned" role="list">
        {titles.map((title) => {
          const here = title.mediaId === mediaId;
          return (
            // biome-ignore lint/a11y/useSemanticElements: an item of the list above.
            <div
              key={title.mediaId}
              className={here ? "uni__node here" : "uni__node"}
              role="listitem"
            >
              <span className="label uni__rel">
                {here ? "You are here" : relationTo(links, mediaId, title.mediaId)}
              </span>
              <span className="uni__rail" />
              <TitleCard title={title} status={status.get(title.mediaId)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

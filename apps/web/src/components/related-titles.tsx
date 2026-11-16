import { Suspense } from "react";
import { RELATION_HEADINGS, TITLE_RELATIONS } from "@/lib/links";
import { getQueryClient, trpc } from "@/trpc/server";
import { TitleCard, titleGridClasses } from "./title-card";

type Props = { mediaId: string };

async function Links({ mediaId }: Props) {
  const links = await getQueryClient().fetchQuery(trpc.links.forTitle.queryOptions({ mediaId }));
  if (links.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-16">
      <h2 id="related-heading" className="font-display text-2xl font-bold tracking-tight">
        Related titles
      </h2>
      {TITLE_RELATIONS.map((relation) => {
        const group = links.filter((link) => link.relation === relation);
        if (group.length === 0) return null;
        return (
          <div key={relation} className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground">
              {RELATION_HEADINGS[relation]}
            </h3>
            <ul className={`mt-3 ${titleGridClasses}`}>
              {group.map((link) => (
                <li key={link.id}>
                  <TitleCard {...link.title} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The titles a reviewer has linked to this one: what it is based on, its adaptations, what
 * comes before and after it, and the rest of its franchise. Shows nothing when there are none.
 */
export function RelatedTitles(props: Props) {
  return (
    <Suspense fallback={null}>
      <Links {...props} />
    </Suspense>
  );
}

import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Average, Meter, Score } from "@/components/media/score";
import { WantButton } from "@/components/media/want-button";
import { Ambient } from "@/components/ui/ambient";
import { Icon } from "@/components/ui/icon";
import { Crumb } from "@/components/ui/page-header";
import { SectionHead } from "@/components/ui/section-head";
import { NameUniverse } from "@/components/universe/name-universe";
import { UniverseMap } from "@/components/universe/universe-map";
import { UniverseTile } from "@/components/universe/universe-tile";
import { WantTheRest } from "@/components/universe/want-the-rest";
import { pluralize } from "@/lib/format";
import { type LibraryStatus, STATUS_ICONS, statusLabel } from "@/lib/library";
import {
  directRelations,
  pageLead,
  type Universe,
  type UniverseTitle,
  universePath,
  universeProgress,
} from "@/lib/links";
import { mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { ambientOf, tonedClass, toneStyle } from "@/lib/titles";
import { getMarksOfAll } from "@/lib/universes";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

const MORE_UNIVERSES = 3;

function getUniverse(id: string) {
  return orNotFound(getQueryClient().fetchQuery(trpc.links.universe.queryOptions({ id })));
}

export async function generateMetadata({
  params,
}: PageProps<"/youniverses/[id]">): Promise<Metadata> {
  const universe = await getUniverse((await params).id);
  return { title: `${universe.name} universe`, description: universe.description };
}

function wantLabel(missing: number, total: number): string {
  if (missing === total) return `Want all ${total}`;
  return missing === 1 ? "Want the other one" : `Want the other ${missing}`;
}

type ProgressProps = {
  universe: Universe;
  status: Map<string, LibraryStatus>;
  /** Where a visitor is sent to sign in, or null for someone who is signed in. */
  signInPath: string | null;
};

/** How far the person is through the universe, and one button to want the rest of it. */
function Progress({ universe, status, signInPath }: ProgressProps) {
  const { titles } = universe;
  if (signInPath) {
    const mediums = new Set(titles.map((title) => title.type)).size;
    return (
      <div className="match">
        <div>
          <b>{pluralize(titles.length, "title")}</b>
          <div className="hint" style={{ marginTop: 4 }}>
            across {pluralize(mediums, "medium", "mediums")}
          </div>
        </div>
        <Link className="btn btn--sm btn--soft" href={signInPath} style={{ marginLeft: 8 }}>
          <Icon name="plus" size="sm" />
          {wantLabel(titles.length, titles.length)}
        </Link>
      </div>
    );
  }

  const { total, finished, started, wanted } = universeProgress(titles, status);
  const missing = titles.filter((title) => !status.has(title.mediaId));
  return (
    <div className="match" style={{ "--ring-c": "var(--tone)" } as CSSProperties}>
      <Meter value={(finished / total) * 100} />
      <div>
        <b>
          {finished} of {total}
        </b>
        <div className="hint" style={{ marginTop: 4 }}>
          finished
          {started > 0 && `, ${started} in progress`}
          {wanted > 0 && `, ${wanted} wanted`}
        </div>
      </div>
      {missing.length > 0 && (
        <WantTheRest
          universeName={universe.name}
          mediaIds={missing.map((title) => title.mediaId)}
          label={wantLabel(missing.length, total)}
        />
      )}
    </div>
  );
}

/** What a title is to the titles it is linked to: the lines of the map, in words. */
function Relations({ universe, title }: { universe: Universe; title: UniverseTitle }) {
  const relations = directRelations(universe.links, universe.titles, title.mediaId);
  if (relations.length === 0) return null;
  return (
    <p className="rank__note rank__rels">
      {relations.map(({ relation, titles }) => (
        <span key={relation} className="rank__rel">
          <span className="label">{relation}</span>
          {titles.map((other, index) => (
            <span key={other.mediaId}>
              <Medium type={other.type} label={false} />
              {other.title}
              {index < titles.length - 1 && ","}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}

export default async function UniversePage({ params }: PageProps<"/youniverses/[id]">) {
  const { id } = await params;
  const queryClient = getQueryClient();
  const [universe, everyUniverse, session, canReview] = await Promise.all([
    getUniverse(id),
    queryClient.fetchQuery(trpc.links.universes.queryOptions()),
    getSession(),
    queryClient.fetchQuery(trpc.links.canReview.queryOptions()),
  ]);
  const { titles } = universe;
  const mediaIds = titles.map((title) => title.mediaId);
  const others = everyUniverse.filter((other) => other.id !== universe.id).slice(0, MORE_UNIVERSES);
  const [marks, averages] = await Promise.all([
    getMarksOfAll([
      ...mediaIds,
      ...others.flatMap((other) => other.titles.map((title) => title.mediaId)),
    ]),
    queryClient.fetchQuery(trpc.ratings.averages.queryOptions({ mediaIds })),
  ]);
  const averageOf = new Map(averages.map((rating) => [rating.mediaId, rating.average]));
  const lead = pageLead(titles);
  const signInPath = session
    ? null
    : `/sign-in?next=${encodeURIComponent(universePath(universe.id))}`;

  return (
    <>
      <Ambient src={lead && ambientOf(lead)} />
      <div className={cn("page", tonedClass(lead))} style={toneStyle(lead)}>
        <Crumb href="/youniverses">Youniverses</Crumb>
        <header className="ph" style={{ marginTop: 14 }}>
          <div className="ph__text">
            <span className="label">
              <Icon name="orbit" size="sm" /> Story universe
            </span>
            <h1 className="d1">{universe.name}</h1>
            {universe.description && <p className="lede">{universe.description}</p>}
            {canReview && (
              <div>
                <NameUniverse
                  mediaId={universe.id}
                  name={universe.name}
                  description={universe.description}
                  named={universe.named}
                />
              </div>
            )}
          </div>
          <Progress universe={universe} status={marks.status} signInPath={signInPath} />
        </header>

        <UniverseMap universe={universe} status={marks.status} />

        <section className="section" aria-labelledby="order-h">
          <SectionHead
            id="order-h"
            title="In release order"
            sub="A sensible way through, if you are starting from nothing"
          />
          <ol>
            {titles.map((title, index) => {
              const status = marks.status.get(title.mediaId);
              return (
                <li key={title.mediaId} className="rank">
                  <span className="rank__n">{index + 1}</span>
                  <Thumb title={title} decorative />
                  <div className="min-w-0">
                    <Link
                      className="row__title"
                      href={mediaPath(title.type, title.providerId)}
                      style={{ display: "block", fontSize: 16 }}
                    >
                      {title.title}
                    </Link>
                    <div className="row__sub">
                      <Medium type={title.type} />
                      <span>{title.releaseYear ?? "TBA"}</span>
                      <Average value={averageOf.get(title.mediaId)} />
                    </div>
                    <Relations universe={universe} title={title} />
                  </div>
                  <div className="row__end">
                    <Score value={marks.rating.get(title.mediaId)} />
                    {status ? (
                      <span className="chip">
                        <Icon name={STATUS_ICONS[status]} size="sm" />
                        {statusLabel(status, title.type)}
                      </span>
                    ) : signInPath ? (
                      <Link
                        className="btn btn--sm btn--soft"
                        href={signInPath}
                        aria-label={`Want: ${title.title}`}
                      >
                        <Icon name="plus" size="sm" />
                        Want
                      </Link>
                    ) : (
                      <WantButton mediaId={title.mediaId} type={title.type} title={title.title} />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {others.length > 0 && (
          <section className="section" aria-labelledby="more-h">
            <SectionHead id="more-h" title="More Youniverses" />
            <div className="tiles">
              {others.map((other) => (
                <UniverseTile
                  key={other.id}
                  universe={other}
                  finished={
                    session ? universeProgress(other.titles, marks.status).finished : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

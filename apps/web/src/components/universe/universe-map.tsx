import Link from "next/link";
import { type CSSProperties, Fragment } from "react";
import { Artwork } from "@/components/media/artwork";
import { Icon } from "@/components/ui/icon";
import { type LibraryStatus, statusLabel } from "@/lib/library";
import { mapLayout, type Universe, type UniverseTitle } from "@/lib/links";
import { MEDIA, mediaPath } from "@/lib/media";
import { MapEdges } from "./map-edges";

type Props = {
  universe: Universe;
  /** The signed-in person's library status for each title, by media id. */
  status: Map<string, LibraryStatus>;
};

const columnKey = (year: number | null) => year ?? "undated";

function MapNode({ title, status }: { title: UniverseTitle; status?: LibraryStatus }) {
  // The lane and the column say these in the grid; a screen reader gets them with the name.
  const name = [
    title.title,
    MEDIA[title.type].one,
    title.releaseYear ?? "no date yet",
    status && statusLabel(status, title.type),
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Link
      className="map__node"
      href={mediaPath(title.type, title.providerId)}
      data-node={title.mediaId}
      aria-label={name}
    >
      <Artwork title={title} size="small" link={false} status={status} />
      <span>{title.title}</span>
    </Link>
  );
}

/**
 * One universe laid out as a map: a lane for each medium, a column for each year, and a line
 * for each verified link. Without the lines it is still a grid of links to every title.
 */
export function UniverseMap({ universe, status }: Props) {
  const { titles, links } = universe;
  const { years, lanes } = mapLayout(titles);
  const kinds = new Set(links.map((link) => link.kind));

  return (
    <>
      <div className="map">
        <div className="map__grid" style={{ "--cols": years.length } as CSSProperties}>
          <span className="map__year" />
          {years.map((year) => (
            <span key={columnKey(year)} className="map__year">
              {year ?? "TBA"}
            </span>
          ))}
          {lanes.map((lane) => (
            <Fragment key={lane}>
              <span className={`map__lane c-${lane}`}>
                <Icon name={MEDIA[lane].icon} size="sm" />
                <span style={{ color: "var(--fg-2)" }}>{MEDIA[lane].label}</span>
              </span>
              {years.map((year) => (
                <div key={columnKey(year)} className="map__cell">
                  {titles
                    .filter((title) => title.type === lane && title.releaseYear === year)
                    .map((title) => (
                      <MapNode
                        key={title.mediaId}
                        title={title}
                        status={status.get(title.mediaId)}
                      />
                    ))}
                </div>
              ))}
            </Fragment>
          ))}
          <MapEdges links={links} />
        </div>
      </div>
      <div className="legend">
        <span>
          <i aria-hidden="true" />
          Follows
        </span>
        <span>
          <i className="adapt" aria-hidden="true" />
          Adapted as
        </span>
        {kinds.has("same_franchise") && (
          <span>
            <i className="same" aria-hidden="true" />
            Same universe
          </span>
        )}
        <span>Every link here was checked by a reviewer before it appeared.</span>
      </div>
    </>
  );
}

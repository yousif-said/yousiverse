import Link from "next/link";
import type { CSSProperties } from "react";
import { type LibraryStatus, statusLabel } from "@/lib/library";
import { mediaPath } from "@/lib/media";
import { ratioOf, type TitleArt } from "@/lib/titles";
import { Artwork } from "./artwork";
import { Medium } from "./medium";

type Props = {
  title: TitleArt;
  /** The line under the name. Defaults to the medium and the year. */
  meta?: React.ReactNode;
  /** A reason this title is here: "Because you rated Dune 9". */
  why?: React.ReactNode;
  /** The signed-in person's status, marked on the artwork. */
  status?: LibraryStatus | null;
};

/** The medium's icon and the year: the default second line of a card or row. */
export function YearMeta({ title }: { title: TitleArt }) {
  return (
    <>
      <Medium type={title.type} label={false} />
      <span>{title.releaseYear ?? "TBA"}</span>
    </>
  );
}

/**
 * A title on a shelf or a wall. Cards in one row share a height and differ in width, because
 * every medium keeps its own shape. A show's name is set on its artwork, so it has none below.
 */
export function TitleCard({ title, meta, why, status }: Props) {
  const isShow = title.type === "tv";
  return (
    <article className="card" style={{ "--ratio": ratioOf(title) } as CSSProperties}>
      <Artwork title={title} status={status} decorative={!isShow} />
      <div>
        {!isShow && (
          <Link className="card__title" href={mediaPath(title.type, title.providerId)}>
            {title.title}
          </Link>
        )}
        <div className="card__meta">
          {meta ?? <YearMeta title={title} />}
          {/* The mark on the artwork is hidden with its decorative link, so say it here. */}
          {status && !isShow && <span className="sr-only">{statusLabel(status, title.type)}</span>}
        </div>
        {why && <div className="card__why">{why}</div>}
      </div>
    </article>
  );
}

/** A row of cards that scrolls sideways. Tabbing through its cards scrolls it for keyboards. */
export function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="shelf">{children}</div>;
}

/** Cards that wrap onto as many rows as they need. */
export function Wall({ children }: { children: React.ReactNode }) {
  return <div className="wall">{children}</div>;
}

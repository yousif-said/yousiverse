import { cn } from "cn";
import type { CSSProperties } from "react";
import type { MediaType } from "@/lib/media";
import { ratioOf } from "@/lib/titles";

/**
 * The parts a loading page is drawn from. Each one sits in the real page's own layout classes,
 * so what arrives lands where its placeholder was.
 */

type BoneProps = {
  /** A size from the parts file: `d1`, `d2`, `d3`, `lede`, `text`, `seg`, `thumb`. */
  as?: "d1" | "d2" | "d3" | "lede" | "text" | "seg" | "thumb";
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
};

/** One block still loading. */
export function Bone({ as, width, height, className, style }: BoneProps) {
  return (
    <div
      className={cn("skel", as && `skel--${as}`, className)}
      style={{ width, height, ...style }}
    />
  );
}

/** The numbers from 0 up to a count, for repeating a placeholder. */
export const times = (count: number) => Array.from({ length: count }, (_, index) => index);

/** A page that is still loading: the page's own frame, marked busy and saying so. */
export function LoadingPage({ narrow, children }: { narrow?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("page", narrow && "page--narrow")} aria-busy="true">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

/** The top of a page: its heading, the line under it, and whatever sits at the far end. */
export function HeaderBones({
  lede = true,
  actions,
}: {
  lede?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <header className="ph">
      <div className="ph__text">
        <Bone as="d2" />
        {lede && <Bone as="lede" />}
      </div>
      {actions && <div className="ph__actions">{actions}</div>}
    </header>
  );
}

export function TabsBones({ count = 5 }: { count?: number }) {
  return (
    <div className="tabs">
      {times(count).map((tab) => (
        <Bone key={tab} as="text" width={56 + (tab % 3) * 22} />
      ))}
    </div>
  );
}

/** A section's heading, with the line under it when the real one has one. */
export function HeadBones({ sub }: { sub?: boolean }) {
  return (
    <div className="sh">
      <div>
        <Bone as="d3" />
        {sub && <Bone as="text" width={260} className="mt-2" />}
      </div>
    </div>
  );
}

/** A mix of media, so a row of placeholders has the uneven skyline a real one has. */
const MIXED: MediaType[] = ["movie", "tv", "book", "game", "movie", "book", "tv", "game"];

/** One title's card: its artwork in its medium's shape, and two lines under it. */
export function CardBones({ type }: { type: MediaType }) {
  return (
    <div className="card" style={{ "--ratio": ratioOf({ type }) } as CSSProperties}>
      <div className={`art art--${type} skel`} />
      <div>
        <Bone as="text" width="78%" />
        <Bone as="text" width="46%" className="mt-2" />
      </div>
    </div>
  );
}

type CardsProps = { count?: number; type?: MediaType };

const cards = ({ count = 8, type }: CardsProps) =>
  times(count).map((card) => (
    <CardBones key={card} type={type ?? MIXED[card % MIXED.length] ?? "movie"} />
  ));

/** A single row of cards that scrolls sideways. */
export function ShelfBones(props: CardsProps) {
  return <div className="shelf">{cards(props)}</div>;
}

/** Cards that wrap onto as many rows as they need. */
export function WallBones(props: CardsProps) {
  return <div className="wall">{cards(props)}</div>;
}

/** A title as one line of a list: thumbnail, two lines of text, and something at the end. */
export function RowBones({ className }: { className?: string }) {
  return (
    <div className={cn("row", className)}>
      <Bone as="thumb" />
      <div className="min-w-0">
        <Bone as="text" width="52%" />
        <Bone as="text" width="30%" className="mt-2" />
      </div>
      <Bone as="text" width={64} />
    </div>
  );
}

/** A panel in a side column, as tall as the one it stands in for. */
export function PanelBones({ height }: { height: number }) {
  return <Bone height={height} style={{ borderRadius: 18 }} />;
}

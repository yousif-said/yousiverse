import type { UniverseLink } from "@/lib/links";

/** Where a title sits on a universe's map, measured from the grid's top left corner. */
export type Box = {
  /** The artwork's edges and center. */
  left: number;
  right: number;
  top: number;
  x: number;
  y: number;
  /** The bottom of the title's name, under its artwork. */
  bottom: number;
};

export type Edge = { key: string; d: string; className?: string };

// How far a line stops short of the artwork it joins.
const GAP = 6;

const CLASSES: Record<UniverseLink["kind"], string | undefined> = {
  sequel_of: undefined,
  adaptation_of: "adapt",
  same_franchise: "same",
};

/**
 * The line for each link of a universe's map, as SVG paths. Titles level with each other (one
 * medium's lane) join side to side with a straight line; the rest drop from the upper title to
 * the lower one in a curve. A link to a title that is not on the map draws nothing.
 */
export function edgePaths(links: UniverseLink[], boxOf: (mediaId: string) => Box | null): Edge[] {
  const joins = links.flatMap((link) => {
    const [a, b] = [boxOf(link.fromMediaId), boxOf(link.toMediaId)];
    if (!a || !b) return [];
    return { link, a, b, level: a.top < b.bottom && b.top < a.bottom };
  });
  const drops = joins.filter((join) => !join.level);

  return joins.map(({ link, a, b, level }) => {
    const key = `${link.fromMediaId}-${link.toMediaId}`;
    const className = CLASSES[link.kind];
    if (level) {
      const [left, right] = a.x < b.x ? [a, b] : [b, a];
      const d = `M${left.right + GAP} ${left.y} L${right.left - GAP} ${right.y}`;
      return { key, className, d };
    }
    const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
    const [y1, y2] = [upper.bottom + GAP, lower.top - GAP];
    // Each drop turns at its own height, so two never run along the same line.
    const turn = drops.findIndex((drop) => drop.link === link) + 1;
    const middle = y1 + ((y2 - y1) * turn) / (drops.length + 1);
    const d = `M${upper.x} ${y1} C${upper.x} ${middle}, ${lower.x} ${middle}, ${lower.x} ${y2}`;
    return { key, className, d };
  });
}

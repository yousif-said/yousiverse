"use client";

import { useEffect, useRef, useState } from "react";
import type { UniverseLink } from "@/lib/links";
import { type Box, type Edge, edgePaths } from "./edges";

function measure(grid: Element, mediaId: string): Box | null {
  const node = grid.querySelector(`[data-node="${mediaId}"]`);
  const picture = node?.querySelector(".art")?.getBoundingClientRect();
  if (!node || !picture) return null;
  const frame = grid.getBoundingClientRect();
  return {
    left: picture.left - frame.left,
    right: picture.right - frame.left,
    top: picture.top - frame.top,
    x: picture.left - frame.left + picture.width / 2,
    y: picture.top - frame.top + picture.height / 2,
    bottom: node.getBoundingClientRect().bottom - frame.top,
  };
}

/**
 * The lines of a universe's map: one for each verified link, between the two titles it joins.
 * They can only be drawn once the browser has laid the grid out, and again whenever its size
 * changes. The map reads without them, and the list under it says the same in words.
 */
export function MapEdges({ links }: { links: UniverseLink[] }) {
  const svg = useRef<SVGSVGElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const grid = svg.current?.parentElement;
    if (!grid) return;
    // Reports each size as soon as it starts watching, which draws the lines the first time.
    const observer = new ResizeObserver(() =>
      setEdges(edgePaths(links, (mediaId) => measure(grid, mediaId))),
    );
    observer.observe(grid);
    // A name that wraps once its font has loaded moves its title without resizing the grid.
    for (const node of grid.querySelectorAll("[data-node]")) observer.observe(node);
    return () => observer.disconnect();
  }, [links]);

  return (
    <svg ref={svg} className="map__edges" aria-hidden="true">
      {edges.map(({ key, d, className }) => (
        <path key={key} d={d} className={className} />
      ))}
    </svg>
  );
}

import Link from "next/link";
import { type CSSProperties, useId } from "react";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Meter } from "@/components/media/score";
import { pluralize } from "@/lib/format";
import { tileLead, type UniverseSummary, universePath } from "@/lib/links";
import { toneStyle } from "@/lib/titles";

type Props = {
  universe: UniverseSummary;
  /** How many of its titles the signed-in person has finished. Left out for a visitor. */
  finished?: number;
  /** The level of its name in the page's outline: `h2` where no section heading is above it. */
  heading?: "h2" | "h3";
};

// A lead with no measured color leaves the tile plain instead of borrowing the page's color.
const PLAIN = { "--tone-s": 0 } as CSSProperties;

/** A universe as a tile: its first titles fanned out, what it is, and how far through it you are. */
export function UniverseTile({ universe, finished, heading: Heading = "h3" }: Props) {
  const headingId = useId();
  const { titles } = universe;
  const lead = tileLead(titles);
  const mediums = [...new Set(titles.map((title) => title.type))];

  return (
    <Link
      className="tile toned"
      href={universePath(universe.id)}
      style={lead?.artHue == null ? PLAIN : toneStyle(lead)}
      aria-labelledby={headingId}
    >
      <div className="tile__art">
        {titles.slice(0, 4).map((title) => (
          <Thumb key={title.mediaId} title={title} link={false} />
        ))}
      </div>
      <div>
        <Heading className="d3" id={headingId}>
          {universe.name}
        </Heading>
        {universe.description && (
          <p className="dim" style={{ marginTop: 6, fontSize: 14 }}>
            {universe.description}
          </p>
        )}
      </div>
      <div className="tile__foot">
        <span style={{ display: "inline-flex", gap: 10 }}>
          {mediums.map((type) => (
            <Medium key={type} type={type} label={false} />
          ))}
          <span>{pluralize(titles.length, "title")}</span>
        </span>
        {finished !== undefined && (
          <span className="score score--mine" title="Titles you have finished">
            <Meter value={(finished / titles.length) * 100} />
            {finished} of {titles.length}
            <span className="sr-only"> finished</span>
          </span>
        )}
      </div>
    </Link>
  );
}

import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { mediaPath } from "@/lib/media";
import type { Side } from "./sides";

/** One of the two titles a link joins: its artwork in its medium's shape, its name, and its year. */
export function PairTitle({ side }: { side: Side }) {
  return (
    <div className="pair__t">
      <Thumb title={{ ...side, posterUrl: side.posterUrl ?? null }} decorative />
      <div className="min-w-0">
        <Link
          className="row__title"
          href={mediaPath(side.type, side.providerId)}
          style={{ display: "block", whiteSpace: "normal" }}
        >
          {side.title}
        </Link>
        <div className="row__sub">
          <Medium type={side.type} />
          {side.releaseYear ? <span>{side.releaseYear}</span> : null}
        </div>
      </div>
    </div>
  );
}

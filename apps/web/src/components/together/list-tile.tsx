import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { VisibilityChip } from "@/components/ui/visibility-chip";
import { pluralize } from "@/lib/format";
import { tonedClass, toneStyle } from "@/lib/titles";

type Props = {
  list: RouterOutputs["lists"]["mine"][number] & {
    /** Who made the list, when it is not the viewer's own. */
    owner?: string;
  };
};

/** A list in a grid of lists: its first titles, fanned, and how many it holds. */
export function ListTile({ list }: Props) {
  const lead = list.artwork[0];
  return (
    <Link
      className={cn("tile", tonedClass(lead))}
      href={`/lists/${list.id}`}
      style={toneStyle(lead)}
    >
      {list.artwork.length > 0 && (
        <div className="tile__art">
          {list.artwork.map((title) => (
            <Thumb key={title.mediaId} title={title} link={false} />
          ))}
        </div>
      )}
      <div>
        <h3 className="d3">{list.name}</h3>
        {list.description && (
          <p className="dim line-clamp-3" style={{ marginTop: 6, fontSize: 14 }}>
            {list.description}
          </p>
        )}
      </div>
      <div className="tile__foot">
        <span>
          {pluralize(list.itemCount, "title")}
          {list.owner && ` · by ${list.owner}`}
        </span>
        <VisibilityChip visibility={list.visibility} />
      </div>
    </Link>
  );
}

import type { RouterOutputs } from "@yousiverse/api";
import { Thumb } from "@/components/media/artwork";
import { Meter } from "@/components/media/score";
import { pluralize } from "@/lib/format";

type Props = { match: NonNullable<RouterOutputs["profiles"]["match"]> };

/** How closely the viewer's ratings agree with this person's, and what they both loved. */
export function MatchPanel({ match }: Props) {
  return (
    <div className="match" style={{ marginTop: 26 }}>
      <Meter value={match.percent} />
      <div>
        <b>{match.percent}% in tune</b>
        <div className="hint" style={{ marginTop: 4 }}>
          across the {pluralize(match.shared, "title")} you have both rated
        </div>
      </div>
      {match.bothLoved.length > 0 && (
        <div className="match__loved">
          <span className="hint">You both loved</span>
          <div className="fan">
            {match.bothLoved.map((title) => (
              <Thumb key={title.mediaId} title={title} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

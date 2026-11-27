import type { RouterOutputs } from "@yousiverse/api";
import Link from "next/link";
import { Meter } from "@/components/media/score";
import { Avatar } from "@/components/ui/avatar";
import { formatRating } from "@/lib/format";
import { profilePath } from "@/lib/profile";

export type FollowedRating = RouterOutputs["ratings"]["fromFollowing"][number];

/** What each person the viewer follows rated this title, highest first. Nothing when none did. */
export function FriendsPanel({ ratings }: { ratings: FollowedRating[] }) {
  if (ratings.length === 0) return null;
  return (
    <div className="panel">
      <div className="panel__head">
        <h3 className="label">People you follow</h3>
        <span className="hint">{ratings.length}</span>
      </div>
      <ul className="rows" style={{ margin: "0 -8px" }}>
        {ratings.map(({ username, value }) => (
          <li key={username}>
            <Link
              className="row"
              href={profilePath(username)}
              style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto", padding: "7px 8px" }}
            >
              <Avatar username={username} />
              <span className="row__title">{username}</span>
              <span className="score score--mine">
                <Meter value={(value / 40) * 100} />
                <span className="sr-only">rated it </span>
                {formatRating(value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Avatar } from "@/components/ui/avatar";
import { clubPath } from "@/lib/clubs";
import { pluralize } from "@/lib/format";
import { tonedClass, toneStyle } from "@/lib/titles";
import { AccessChip, PostCount } from "./club-parts";

type Props = {
  club: RouterOutputs["clubs"]["discover"][number];
  /** Whether the viewer is a member, and so cares more about what is being said than who runs it. */
  joined: boolean;
};

/** A club in a grid of clubs: its latest picks, what it covers, who is in it. */
export function ClubTile({ club, joined }: Props) {
  const lead = club.picks[0];
  const latest = club.latestDiscussion;
  return (
    <Link className={cn("tile", tonedClass(lead))} href={clubPath(club.id)} style={toneStyle(lead)}>
      {club.picks.length > 0 && (
        <div className="tile__art">
          {club.picks.map((pick) => (
            <Thumb key={pick.mediaId} title={pick} link={false} />
          ))}
        </div>
      )}
      <div>
        <h3 className="d3">{club.name}</h3>
        {club.description && (
          <p className="dim line-clamp-3" style={{ marginTop: 6, fontSize: 14 }}>
            {club.description}
          </p>
        )}
      </div>
      <div className="tile__meta">
        <span className="inline-flex gap-2">
          {club.mediaTypes.map((type) => (
            <Medium key={type} type={type} label={false} />
          ))}
        </span>
        <AccessChip access={club.access} />
        <span className="avs">
          {club.members.map((username) => (
            <Avatar key={username} username={username} size={22} />
          ))}
        </span>
        <span>{pluralize(club.memberCount, "member")}</span>
      </div>
      <div className="tile__foot">
        {joined ? (
          latest ? (
            <>
              <span className="min-w-0 truncate">{latest.title}</span>
              <PostCount replies={latest.replyCount} />
            </>
          ) : (
            <span>No discussions yet</span>
          )
        ) : (
          <>
            <span className="min-w-0 truncate">
              {club.owner ? `Run by ${club.owner}` : "Run by a Yousiverse member"}
            </span>
            <span className="btn btn--sm btn--primary">Open</span>
          </>
        )}
      </div>
    </Link>
  );
}

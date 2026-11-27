import { Icon } from "@/components/ui/icon";
import { ACCESS, type ClubAccess } from "@/lib/clubs";
import { pluralize } from "@/lib/format";

/** Whether anyone can join a club or only people with its invite link. */
export function AccessChip({ access }: { access: ClubAccess }) {
  return (
    <span className="chip">
      <Icon name={ACCESS[access].icon} size="sm" />
      {ACCESS[access].label}
    </span>
  );
}

/** How much has been said in a discussion: its replies and the post that opened it. */
export function PostCount({ replies }: { replies: number }) {
  const posts = replies + 1;
  return (
    <span className="thread__n">
      <Icon name="msg" size="sm" />
      <span aria-hidden="true">{posts}</span>
      <span className="sr-only">{pluralize(posts, "post")}</span>
    </span>
  );
}

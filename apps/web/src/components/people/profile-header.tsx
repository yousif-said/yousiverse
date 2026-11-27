import type { RouterOutputs } from "@yousiverse/api";
import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { profilePath } from "@/lib/profile";

type Props = {
  profile: RouterOutputs["profiles"]["get"];
  /** Whether anyone is signed in: a visitor is asked to sign in before following. */
  signedIn: boolean;
};

const joinedFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const counted = (count: number) => count.toLocaleString("en-US");

/** The top of a profile: who this is, who follows whom, and the way to follow them. */
export function ProfileHeader({ profile, signedIn }: Props) {
  const { username, followerCount, followingCount } = profile;
  const path = profilePath(username);

  return (
    <header className="prof">
      <Avatar username={username} />
      <div className="min-w-0">
        <h1 className="d2 wrap-anywhere">{profile.name}</h1>
        <p className="dim" style={{ marginTop: 6 }}>
          @{username} · joined {joinedFormat.format(new Date(profile.joinedAt))}
        </p>
        <div className="prof__counts">
          <Link href={`${path}/followers`} scroll={false}>
            <b>{counted(followerCount)}</b> {followerCount === 1 ? "follower" : "followers"}
          </Link>
          <Link href={`${path}/following`} scroll={false}>
            <b>{counted(followingCount)}</b> following
          </Link>
          {profile.isFollowing && profile.followsYou ? (
            <span className="chip chip--good">
              <Icon name="check" size="sm" />
              Friends
            </span>
          ) : (
            profile.followsYou && <span className="chip">Follows you</span>
          )}
        </div>
      </div>
      <div className="ph__actions">
        {profile.isOwner ? (
          <Link className="btn btn--soft" href="/account">
            <Icon name="pencil" />
            Edit profile
          </Link>
        ) : signedIn ? (
          <FollowButton
            key={username}
            username={username}
            name={profile.name}
            initiallyFollowing={profile.isFollowing}
            followsYou={profile.followsYou}
            size="default"
          />
        ) : (
          <p className="hint">
            <Link className="link" href={`/sign-in?next=${encodeURIComponent(path)}`}>
              Sign in
            </Link>{" "}
            to follow {profile.name}.
          </p>
        )}
      </div>
    </header>
  );
}

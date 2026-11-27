import { Shelf, TitleCard } from "@/components/media/title-card";
import { Icon } from "@/components/ui/icon";
import { LinkTabs } from "@/components/ui/link-tabs";
import { SectionHead } from "@/components/ui/section-head";
import type { LibraryStatus } from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { PROFILE_TABS, type ProfileTab, profileTabPath } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";
import { MatchPanel } from "./match-panel";
import { ProfileHeader } from "./profile-header";
import { ProfileLibrary, ProfileLists, ProfilePeople, ProfileReviews } from "./profile-tabs";
import { ScrollToSections } from "./scroll-to-sections";
import { TasteStrip } from "./taste-strip";
import { TheirScore } from "./their-score";

const TAB_LABELS: Record<ProfileTab, string> = {
  library: "Library",
  reviews: "Reviews",
  lists: "Lists",
  following: "Following",
  followers: "Followers",
};

const SECTIONS_ID = "profile-sections";

/** The profile a username in an address names, or the not-found page when nobody has it. */
export function getProfile(username: string) {
  return orNotFound(
    getQueryClient().fetchQuery(
      trpc.profiles.get.queryOptions({ username: decodeURIComponent(username) }),
    ),
  );
}

type Props = {
  /** The username as the address has it. */
  username: string;
  tab: ProfileTab;
  /** Filters for the library tab. */
  type?: MediaType;
  status?: LibraryStatus;
  /** Open at the tabs instead of the top: for an address that names one of them. */
  atTabs?: boolean;
};

/**
 * A person's profile: who they are, their taste in numbers, and what they have made public,
 * one tab at a time. The viewer sees only what they are allowed to, their own profile included.
 */
export async function ProfileView({ username: asked, tab, type, status, atTabs }: Props) {
  const profile = await getProfile(asked);
  const { username, isOwner } = profile;
  const queryClient = getQueryClient();
  const [session, stats, match] = await Promise.all([
    getSession(),
    queryClient.fetchQuery(trpc.profiles.stats.queryOptions({ username })),
    queryClient.fetchQuery(trpc.profiles.match.queryOptions({ username })),
  ]);

  const counts: Record<ProfileTab, number> = {
    library: stats.counts.titles,
    reviews: stats.counts.reviews,
    lists: stats.counts.lists,
    following: profile.followingCount,
    followers: profile.followerCount,
  };
  const [firstName = profile.name] = profile.name.split(" ");

  return (
    <div className="page">
      <ProfileHeader profile={profile} signedIn={Boolean(session)} />
      {isOwner && (
        <div className="note" style={{ marginTop: 22 }}>
          <Icon name="globe" />
          <span>
            This is your profile as everyone sees it. Friends also see what you marked friends only,
            and nobody sees what you marked private.
          </span>
        </div>
      )}
      {match && <MatchPanel match={match} />}
      <TasteStrip stats={stats} rater={isOwner ? "you rate" : `${firstName} rates`} />

      {stats.highestRated.length > 0 && (
        <section className="section" aria-labelledby="highest-rated-heading">
          <SectionHead title="Highest rated" id="highest-rated-heading" />
          <Shelf>
            {stats.highestRated.map((title) => (
              <TitleCard
                key={title.mediaId}
                title={title}
                meta={
                  <>
                    <TheirScore value={title.rating} username={username} mine={isOwner} />
                    <span>{title.releaseYear ?? ""}</span>
                  </>
                }
              />
            ))}
          </Shelf>
        </section>
      )}

      <section className="section" id={SECTIONS_ID} style={{ scrollMarginTop: 24 }}>
        {atTabs && <ScrollToSections id={SECTIONS_ID} />}
        <LinkTabs
          label="Profile sections"
          choices={PROFILE_TABS.map((option) => ({
            href: profileTabPath(username, option),
            label: TAB_LABELS[option],
            current: option === tab,
            count: counts[option],
          }))}
        />
        <section aria-label={TAB_LABELS[tab]} style={{ marginTop: 30 }}>
          {tab === "library" && (
            <ProfileLibrary username={username} isOwner={isOwner} type={type} status={status} />
          )}
          {tab === "reviews" && <ProfileReviews username={username} isOwner={isOwner} />}
          {tab === "lists" && <ProfileLists username={username} isOwner={isOwner} />}
          {(tab === "following" || tab === "followers") && (
            <ProfilePeople username={username} side={tab} />
          )}
        </section>
      </section>
    </div>
  );
}

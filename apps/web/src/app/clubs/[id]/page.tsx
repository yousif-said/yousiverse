import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Meter } from "@/components/media/score";
import { Shelf, TitleCard } from "@/components/media/title-card";
import { MemberName } from "@/components/member-name";
import { PersonRow } from "@/components/people/person-row";
import { getViewer } from "@/components/shell/viewer";
import { ClubMembership } from "@/components/together/club-membership";
import { AccessChip, PostCount } from "@/components/together/club-parts";
import { ClubSettings } from "@/components/together/club-settings";
import { CopyLinkButton } from "@/components/together/copy-link-button";
import { RemovePickButton } from "@/components/together/remove-pick-button";
import { StartDiscussionButton } from "@/components/together/start-discussion-button";
import { Ambient } from "@/components/ui/ambient";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Crumb } from "@/components/ui/page-header";
import { SectionHead } from "@/components/ui/section-head";
import { clubPath, coveredTypes, discussionPath } from "@/lib/clubs";
import { agoLabel, dayOf, midSentence } from "@/lib/days";
import { formatRating, pluralize } from "@/lib/format";
import { getMarks } from "@/lib/marks";
import { MEDIA } from "@/lib/media";
import { ambientOf, tonedClass, toneStyle } from "@/lib/titles";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/clubs/[id]">;
type ClubPick = RouterOutputs["clubs"]["picks"][number];
type Discussion = RouterOutputs["discussions"]["list"][number];

/** How many members' marks sit beside the club's name. */
const MEMBERS_IN_HEAD = 6;

async function getClub({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, { invite }] = await Promise.all([params, searchParams]);
  const code = typeof invite === "string" ? invite : undefined;
  const club = await orNotFound(
    getQueryClient().fetchQuery(trpc.clubs.get.queryOptions({ id, invite: code })),
  );
  return { club, invite: code };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { club } = await getClub(props);
  return { title: club.name, description: club.description };
}

/** The address this site is being served from, for building a link someone can share. */
async function siteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** What the club's members make of a pick: their average, and how many of them rated it. */
function ClubRating({ rating }: { rating: ClubPick["clubRating"] }) {
  if (!rating) return <span>No club ratings yet</span>;
  return (
    <>
      <span className="score score--all" title="Club average">
        <Meter value={(rating.average / 40) * 100} />
        <span className="sr-only">Club average: </span>
        {(rating.average / 4).toFixed(1)}
      </span>
      <span>
        from {rating.count}
        <span className="sr-only"> {rating.count === 1 ? "rating" : "ratings"}</span>
      </span>
    </>
  );
}

function DiscussionRow({ clubId, discussion }: { clubId: string; discussion: Discussion }) {
  const lastActive = midSentence(agoLabel(dayOf(new Date(discussion.activeAt))));
  return (
    <li>
      <Link className="thread" href={discussionPath(clubId, discussion.id)}>
        <Avatar username={discussion.author} size={40} />
        <div className="min-w-0">
          <div className="thread__t">{discussion.title}</div>
          <div className="thread__s">
            Started by {discussion.author ?? "a former member"} ·{" "}
            {discussion.replyCount > 0 ? `last reply ${lastActive}` : "no replies yet"}
          </div>
        </div>
        <PostCount replies={discussion.replyCount} />
      </Link>
    </li>
  );
}

export default async function ClubPage(props: Props) {
  const [{ club, invite }, viewer] = await Promise.all([getClub(props), getViewer()]);
  const inside = club.isMember || club.access === "public";
  // Someone only holding an invite is not shown the club's picks or discussions.
  const [picks, discussions] = inside
    ? await Promise.all([
        getQueryClient().fetchQuery(trpc.clubs.picks.queryOptions({ id: club.id })),
        getQueryClient().fetchQuery(trpc.discussions.list.queryOptions({ clubId: club.id })),
      ])
    : [[], []];
  const marks = await getMarks(picks.map((pick) => pick.mediaId));
  const lead = picks[0];

  const pickedBy = (pick: ClubPick) => {
    if (!pick.addedBy) return "a former member";
    return pick.addedBy === viewer?.username ? "you" : pick.addedBy;
  };

  return (
    <>
      <Ambient src={lead ? ambientOf(lead) : null} />
      <div className={cn("page", tonedClass(lead))} style={toneStyle(lead)}>
        <Crumb href="/clubs">Clubs</Crumb>
        <header className="clubhead" style={{ marginTop: 14 }}>
          <div className="ph__text">
            <div className="tile__meta">
              <span className="inline-flex gap-3">
                {club.mediaTypes.map((type) => (
                  <span key={type} className={`med med--${type}`}>
                    <Icon name={MEDIA[type].icon} size="sm" />
                    {MEDIA[type].label}
                  </span>
                ))}
              </span>
              <AccessChip access={club.access} />
            </div>
            <h1 className="d1">{club.name}</h1>
            {club.description && <p className="lede whitespace-pre-line">{club.description}</p>}
            <div className="tile__meta" style={{ marginTop: 4 }}>
              {club.members.length > 0 && (
                <span className="avs">
                  {club.members.slice(0, MEMBERS_IN_HEAD).map((member) => (
                    <Avatar key={member.username} username={member.username} size={28} />
                  ))}
                </span>
              )}
              <span>
                {pluralize(club.memberCount, "member")}, run by{" "}
                {club.isOwner ? "you" : <MemberName username={club.owner} />}
              </span>
            </div>
          </div>
          <div className="ph__actions">
            {club.isOwner ? (
              <>
                <CopyLinkButton path={clubPath(club.id, club.inviteCode)}>
                  <Icon name="link" />
                  Copy invite link
                </CopyLinkButton>
                <ClubSettings
                  club={club}
                  inviteLink={`${await siteOrigin()}${clubPath(club.id, club.inviteCode)}`}
                />
              </>
            ) : viewer ? (
              (club.isMember || club.canJoin) && (
                <ClubMembership
                  club={{ id: club.id, name: club.name, access: club.access }}
                  isMember={club.isMember}
                  invite={invite}
                />
              )
            ) : (
              <Link
                className="btn btn--primary btn--lg"
                href={`/sign-in?next=${encodeURIComponent(clubPath(club.id, invite))}`}
              >
                Sign in to join
              </Link>
            )}
          </div>
        </header>

        {inside ? (
          <>
            <section className="section" aria-labelledby="picks-h">
              <SectionHead
                title="Picks"
                id="picks-h"
                sub={club.isMember ? "Pick a title for this club from its own page" : undefined}
              />
              {picks.length === 0 ? (
                <div className="empty">
                  No picks yet.
                  {club.isMember &&
                    ` Open the page of any of the ${coveredTypes(club.mediaTypes).toLowerCase()} this club covers and choose “Pick for a club”.`}
                </div>
              ) : (
                <Shelf>
                  {picks.map((pick) => {
                    const mine = marks.rating.get(pick.mediaId);
                    return (
                      <TitleCard
                        key={pick.mediaId}
                        title={pick}
                        meta={<ClubRating rating={pick.clubRating} />}
                        why={
                          <>
                            {mine !== undefined && `You ${formatRating(mine)} · `}
                            picked by {pickedBy(pick)}
                            {pick.canRemove && (
                              <>
                                {" · "}
                                <RemovePickButton
                                  clubId={club.id}
                                  mediaId={pick.mediaId}
                                  title={pick.title}
                                />
                              </>
                            )}
                          </>
                        }
                      />
                    );
                  })}
                </Shelf>
              )}
            </section>

            <section className="section" aria-labelledby="discussions-h">
              <SectionHead
                title="Discussions"
                id="discussions-h"
                action={club.isMember ? <StartDiscussionButton clubId={club.id} /> : undefined}
              />
              {discussions.length === 0 ? (
                <div className="empty">
                  No discussions yet.{club.isMember && " Start the first one."}
                </div>
              ) : (
                <ul>
                  {discussions.map((discussion) => (
                    <DiscussionRow key={discussion.id} clubId={club.id} discussion={discussion} />
                  ))}
                </ul>
              )}
            </section>

            <section className="section" aria-labelledby="members-h">
              <SectionHead
                title="Members"
                id="members-h"
                sub={pluralize(club.memberCount, "member")}
              />
              <ul
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "0 40px",
                }}
              >
                {club.members.map((member) => (
                  <PersonRow
                    key={member.username}
                    person={member}
                    note={member.username === club.owner ? "Runs this club" : undefined}
                  >
                    {member.isViewer ? (
                      <span className="chip">You</span>
                    ) : (
                      viewer && (
                        <FollowButton
                          username={member.username}
                          name={member.name}
                          followsYou={member.followsYou}
                          initiallyFollowing={member.isFollowing}
                        />
                      )
                    )}
                  </PersonRow>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <div className="empty" style={{ marginTop: 40 }}>
            You have been invited to this club. Join it to see its picks, discussions, and members.
          </div>
        )}
      </div>
    </>
  );
}

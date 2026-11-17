import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ClubMembership } from "@/components/club-membership";
import { ClubSettings } from "@/components/club-settings";
import { DiscussionForm } from "@/components/discussion-form";
import { MemberName } from "@/components/member-name";
import { PeopleList } from "@/components/people-list";
import { RemovePickButton } from "@/components/remove-pick-button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import { ACCESS_LABELS, clubPath, coveredTypes, discussionPath } from "@/lib/clubs";
import { formatAverageRating, formatDay, pluralize } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/clubs/[id]">;

const sectionHeading = "font-display text-2xl font-bold tracking-tight";

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

export default async function ClubPage(props: Props) {
  const [{ club, invite }, session] = await Promise.all([getClub(props), getSession()]);
  const inside = club.isMember || club.access === "public";
  // Someone only holding an invite is not shown the club's picks or discussions.
  const [picks, discussions] = inside
    ? await Promise.all([
        getQueryClient().fetchQuery(trpc.clubs.picks.queryOptions({ id: club.id })),
        getQueryClient().fetchQuery(trpc.discussions.list.queryOptions({ clubId: club.id })),
      ])
    : [[], []];

  return (
    <div className="pt-10 sm:pt-16">
      <p className="text-sm">
        <Link
          href="/clubs"
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Clubs
        </Link>
      </p>
      <h1 className="mt-2 max-w-3xl text-balance font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
        {club.name}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {coveredTypes(club.mediaTypes)}. {ACCESS_LABELS[club.access].label} club run by{" "}
        {club.isOwner ? "you" : <MemberName username={club.owner} />},{" "}
        {pluralize(club.memberCount, "member")}.
      </p>
      {club.description && (
        <p className="mt-6 max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
          {club.description}
        </p>
      )}

      {!club.isOwner && (
        <div className="mt-6">
          {session ? (
            (club.isMember || club.canJoin) && (
              <ClubMembership clubId={club.id} isMember={club.isMember} invite={invite} />
            )
          ) : (
            <SignInPrompt returnTo={clubPath(club.id, invite)}>to join this club.</SignInPrompt>
          )}
        </div>
      )}
      {club.isOwner && club.inviteCode && (
        <ClubSettings club={club} inviteCode={club.inviteCode} origin={await siteOrigin()} />
      )}

      {inside && (
        <section aria-labelledby="picks-heading" className="mt-14">
          <h2 id="picks-heading" className={sectionHeading}>
            Picks
          </h2>
          {picks.length === 0 ? (
            <p className="mt-4 max-w-[65ch] text-muted-foreground">
              No picks yet.
              {club.isMember &&
                ` Open the page of any of the ${coveredTypes(club.mediaTypes).toLowerCase()} this club covers and choose “Pick for a club”.`}
            </p>
          ) : (
            <ul className={`mt-6 ${titleGridClasses}`}>
              {picks.map((pick) => (
                <li key={pick.mediaId}>
                  <TitleCard
                    {...pick}
                    note={
                      pick.clubRating
                        ? `Club average ${formatAverageRating(pick.clubRating.average)} from ${pluralize(pick.clubRating.count, "rating")}`
                        : "No club ratings yet"
                    }
                  />
                  {pick.canRemove && (
                    <RemovePickButton clubId={club.id} mediaId={pick.mediaId} title={pick.title} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {inside && (
        <section aria-labelledby="discussions-heading" className="mt-14 max-w-3xl">
          <h2 id="discussions-heading" className={sectionHeading}>
            Discussions
          </h2>
          {discussions.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              No discussions yet.{club.isMember && " Start the first one below."}
            </p>
          ) : (
            <ul className="mt-4 divide-y border-y">
              {discussions.map((discussion) => (
                <li key={discussion.id} className="py-4">
                  <Link
                    href={discussionPath(club.id, discussion.id)}
                    className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {discussion.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Started by {discussion.author ?? "a former member"},{" "}
                    {pluralize(discussion.replyCount, "reply", "replies")}, last active{" "}
                    {formatDay(new Date(discussion.activeAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {club.isMember && (
            <details className="mt-6">
              <summary className="w-fit cursor-pointer rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Start a discussion
              </summary>
              <div className="mt-4">
                <DiscussionForm clubId={club.id} />
              </div>
            </details>
          )}
        </section>
      )}

      {inside ? (
        <section aria-labelledby="members-heading" className="mt-14 max-w-3xl">
          <h2 id="members-heading" className={sectionHeading}>
            Members
          </h2>
          <div className="mt-4">
            <PeopleList people={club.members} />
          </div>
        </section>
      ) : (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          You have been invited to this club. Join it to see its members and what it is up to.
        </p>
      )}
    </div>
  );
}

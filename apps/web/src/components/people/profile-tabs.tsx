import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { TitleCard, Wall } from "@/components/media/title-card";
import { ListTile } from "@/components/together/list-tile";
import { LinkSegmented } from "@/components/ui/link-tabs";
import { agoLabel, dayOf } from "@/lib/days";
import { formatRating, pluralize } from "@/lib/format";
import { LIBRARY_STATUSES, type LibraryStatus, STATUS_LABELS, statusLabel } from "@/lib/library";
import { MEDIA, MEDIA_TYPES, type MediaType, mediaPath } from "@/lib/media";
import { profilePath } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { PersonRow } from "./person-row";
import { TheirScore } from "./their-score";

/** Whose profile a tab belongs to, and whether the person looking is its owner. */
type Owner = { username: string; isOwner: boolean };

type LibraryProps = Owner & { type?: MediaType; status?: LibraryStatus };

/** The part of a person's library the viewer may see, with its filters as links. */
export async function ProfileLibrary({ username, isOwner, type, status }: LibraryProps) {
  const entries = await getQueryClient().fetchQuery(
    trpc.profiles.library.queryOptions({ username, type, status }),
  );
  const filtered = Boolean(type || status);

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <LinkSegmented
          label="Filter library by type"
          choices={[
            { href: profilePath(username, undefined, status), label: "All", current: !type },
            ...MEDIA_TYPES.map((option) => ({
              href: profilePath(username, option, status),
              label: MEDIA[option].label,
              current: option === type,
              icon: MEDIA[option].icon,
              iconClassName: `c-${option}`,
            })),
          ]}
        />
        <LinkSegmented
          small
          label="Filter library by status"
          choices={[
            { href: profilePath(username, type), label: "Any status", current: !status },
            ...LIBRARY_STATUSES.map((option) => ({
              href: profilePath(username, type, option),
              label: STATUS_LABELS[option],
              current: option === status,
            })),
          ]}
        />
      </div>
      {entries.length === 0 ? (
        <div className="empty">
          <p>
            {filtered
              ? "Nothing in this library matches these filters."
              : "Nothing in this library yet."}
          </p>
          {filtered ? (
            <Link className="btn btn--soft btn--sm mt-4" href={profilePath(username)}>
              Show the whole library
            </Link>
          ) : (
            isOwner && (
              <Link className="btn btn--soft btn--sm mt-4" href="/search">
                Find something to add
              </Link>
            )
          )}
        </div>
      ) : (
        <Wall>
          {entries.map((entry) => (
            <TitleCard
              key={entry.mediaId}
              title={entry}
              meta={
                <>
                  <TheirScore value={entry.rating} username={username} mine={isOwner} />
                  <span>{statusLabel(entry.status, entry.type)}</span>
                </>
              }
            />
          ))}
        </Wall>
      )}
    </>
  );
}

/** A person's reviews that the viewer may see, each beside what it is about. */
export async function ProfileReviews({ username, isOwner }: Owner) {
  const reviews = await getQueryClient().fetchQuery(
    trpc.profiles.reviews.queryOptions({ username }),
  );
  if (reviews.length === 0) {
    return (
      <div className="empty">
        <p>No reviews yet.</p>
        {isOwner && (
          <p className="hint mt-2">Write one from the page of anything you have finished.</p>
        )}
      </div>
    );
  }

  return (
    <ul style={{ maxWidth: 760 }}>
      {reviews.map((review) => {
        const { episode } = review;
        const titlePath = mediaPath(review.type, review.providerId);
        return (
          <li key={review.id} className="review">
            <Thumb title={review} decorative />
            <div className="min-w-0">
              <div className="review__who">
                <Link
                  href={
                    episode
                      ? `${titlePath}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`
                      : titlePath
                  }
                >
                  {episode ? `${review.title}: ${episode.name}` : review.title}
                </Link>
              </div>
              <div className="review__when">
                <Medium type={review.type} /> ·{" "}
                {episode && `Season ${episode.seasonNumber}, episode ${episode.episodeNumber} · `}
                {agoLabel(dayOf(new Date(review.createdAt)))}
              </div>
            </div>
            {review.rating !== null && (
              <div className="review__num">
                <span className="sr-only">Rated </span>
                {formatRating(review.rating)}
                <span className="sr-only"> out of 10</span>
              </div>
            )}
            <p className="review__body">{review.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** A person's lists that the viewer may see, as tiles. */
export async function ProfileLists({ username, isOwner }: Owner) {
  const lists = await getQueryClient().fetchQuery(trpc.profiles.lists.queryOptions({ username }));
  if (lists.length === 0) {
    return (
      <div className="empty">
        <p>No lists yet.</p>
        {isOwner && (
          <Link className="btn btn--soft btn--sm mt-4" href="/lists">
            Make a list
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="tiles">
      {lists.map((list) => (
        <ListTile key={list.id} list={{ ...list, owner: isOwner ? undefined : username }} />
      ))}
    </div>
  );
}

type PeopleProps = { username: string; side: "followers" | "following" };

/** Who follows a person, or who they follow, each with a way to follow them too. */
export async function ProfilePeople({ username, side }: PeopleProps) {
  const queryClient = getQueryClient();
  const follows = side === "followers" ? trpc.follows.followers : trpc.follows.following;
  const [{ people, unnamed }, session] = await Promise.all([
    queryClient.fetchQuery(follows.queryOptions({ username })),
    getSession(),
  ]);
  if (people.length === 0 && unnamed === 0) {
    return (
      <div className="empty" style={{ maxWidth: 560 }}>
        {side === "followers" ? "No followers yet." : "Not following anyone yet."}
      </div>
    );
  }

  // A visitor cannot follow anyone, so their rows end with nothing.
  const [me, relations] = session
    ? await Promise.all([
        queryClient.fetchQuery(trpc.profiles.me.queryOptions()),
        queryClient.fetchQuery(
          trpc.profiles.relations.queryOptions({
            usernames: people.map((person) => person.username),
          }),
        ),
      ])
    : [null, null];

  return (
    <>
      <ul style={{ maxWidth: 560 }}>
        {people.map((person) => (
          <PersonRow key={person.username} person={person}>
            {relations &&
              (person.username === me?.username ? (
                <span className="chip">You</span>
              ) : (
                <FollowButton
                  username={person.username}
                  name={person.name}
                  initiallyFollowing={relations.following.includes(person.username)}
                  followsYou={relations.followedBy.includes(person.username)}
                />
              ))}
          </PersonRow>
        ))}
      </ul>
      {unnamed > 0 && (
        <p className="hint" style={{ marginTop: 14 }}>
          {people.length > 0 ? "And " : ""}
          {pluralize(unnamed, "member")} without a username.
        </p>
      )}
      <p className="hint" style={{ marginTop: 14 }}>
        Who follows whom is public. People without a username are counted but not named.
      </p>
    </>
  );
}

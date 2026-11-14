import type { Metadata } from "next";
import Link from "next/link";
import { FilterPill } from "@/components/filter-pill";
import { FollowButton } from "@/components/follow-button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import { formatDay, formatRating, pluralize } from "@/lib/format";
import { isLibraryStatus, LIBRARY_STATUSES, STATUS_LABELS, statusLabel } from "@/lib/library";
import { isMediaType, MEDIA, MEDIA_TYPES, mediaPath } from "@/lib/media";
import { profilePath } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/u/[username]">;

const linkClasses =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";
const sectionHeading = "font-display text-2xl font-bold tracking-tight";
const joinedFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

async function getProfile(params: Props["params"]) {
  const username = decodeURIComponent((await params).username);
  return orNotFound(getQueryClient().fetchQuery(trpc.profiles.get.queryOptions({ username })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params);
  return { title: `${profile.name} (${profile.username})` };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const profile = await getProfile(params);
  const { username } = profile;
  const filters = await searchParams;
  const type = isMediaType(filters.type) ? filters.type : undefined;
  const status = isLibraryStatus(filters.status) ? filters.status : undefined;

  const queryClient = getQueryClient();
  const [session, entries, lists, reviews] = await Promise.all([
    getSession(),
    queryClient.fetchQuery(trpc.profiles.library.queryOptions({ username, type, status })),
    queryClient.fetchQuery(trpc.profiles.lists.queryOptions({ username })),
    queryClient.fetchQuery(trpc.profiles.reviews.queryOptions({ username })),
  ]);
  const signedIn = Boolean(session);

  return (
    <div className="pt-10 sm:pt-16">
      <header>
        <h1 className="text-balance font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
          {profile.name}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {username}, joined {joinedFormat.format(new Date(profile.joinedAt))}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <Link href={`${profilePath(username)}/followers`} className={linkClasses}>
            {pluralize(profile.followerCount, "follower")}
          </Link>
          <Link href={`${profilePath(username)}/following`} className={linkClasses}>
            {profile.followingCount} following
          </Link>
        </p>
        {!profile.isOwner && (
          <div className="mt-6">
            {signedIn ? (
              <>
                <FollowButton username={username} initiallyFollowing={profile.isFollowing} />
                {profile.followsYou && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {profile.isFollowing
                      ? "You follow each other, so you are friends."
                      : "Follows you."}
                  </p>
                )}
              </>
            ) : (
              <SignInPrompt returnTo={profilePath(username)}>
                to follow {profile.name}.
              </SignInPrompt>
            )}
          </div>
        )}
        {profile.isOwner && (
          <p className="mt-4 max-w-[65ch] text-sm text-muted-foreground">
            This is your profile as the public sees it. Your friends also see what you marked
            friends only, and nobody sees what you marked private.{" "}
            <Link href="/account" className={linkClasses}>
              Edit your profile
            </Link>
          </p>
        )}
      </header>

      <section aria-labelledby="library-heading" className="mt-14">
        <h2 id="library-heading" className={sectionHeading}>
          Library
        </h2>
        <nav aria-label="Filter library by type" className="mt-4 flex flex-wrap gap-2">
          <FilterPill href={profilePath(username, undefined, status)} selected={!type}>
            All
          </FilterPill>
          {MEDIA_TYPES.map((option) => (
            <FilterPill
              key={option}
              href={profilePath(username, option, status)}
              selected={option === type}
              color={MEDIA[option].color}
            >
              {MEDIA[option].label}
            </FilterPill>
          ))}
        </nav>
        <nav aria-label="Filter library by status" className="mt-3 flex flex-wrap gap-2">
          <FilterPill href={profilePath(username, type)} selected={!status}>
            Any status
          </FilterPill>
          {LIBRARY_STATUSES.map((option) => (
            <FilterPill
              key={option}
              href={profilePath(username, type, option)}
              selected={option === status}
            >
              {STATUS_LABELS[option]}
            </FilterPill>
          ))}
        </nav>
        {entries.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            {type || status
              ? "Nothing in this library matches these filters."
              : "Nothing in this library yet."}
          </p>
        ) : (
          <ul className={`mt-8 ${titleGridClasses}`}>
            {entries.map((entry) => (
              <li key={entry.mediaId}>
                <TitleCard {...entry} note={statusLabel(entry.status, entry.type)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lists-heading" className="mt-16 max-w-3xl">
        <h2 id="lists-heading" className={sectionHeading}>
          Lists
        </h2>
        {lists.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No lists yet.</p>
        ) : (
          <ul className="mt-4 divide-y border-y">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/lists/${list.id}`}
                  className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{list.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {pluralize(list.itemCount, "title")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reviews-heading" className="mt-16 max-w-3xl">
        <h2 id="reviews-heading" className={sectionHeading}>
          Reviews
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="mt-4 divide-y border-y">
            {reviews.map((review) => {
              const titlePath = mediaPath(review.type, review.providerId);
              const { episode } = review;
              return (
                <li key={review.id} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 py-6">
                  <div>
                    <h3 className="font-medium">
                      <Link
                        href={
                          episode
                            ? `${titlePath}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`
                            : titlePath
                        }
                        className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {episode ? `${review.title}: ${episode.name}` : review.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {episode ? "Episode" : MEDIA[review.type].singular},{" "}
                      {formatDay(new Date(review.createdAt))}
                    </p>
                  </div>
                  {review.rating !== null && (
                    <p className="font-display text-3xl leading-none font-extrabold tabular-nums">
                      <span className="sr-only">Rated </span>
                      {formatRating(review.rating)}
                      <span className="sr-only"> out of 10</span>
                    </p>
                  )}
                  <p className="col-span-full max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
                    {review.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { CSSProperties } from "react";
import { FollowButton } from "@/components/follow-button";
import { TitleCard, Wall, YearMeta } from "@/components/media/title-card";
import { PersonRow } from "@/components/people/person-row";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { UniverseTile } from "@/components/universe/universe-tile";
import { universeProgress } from "@/lib/links";
import { MEDIA, MEDIA_TYPES, type MediaType, searchPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { ratioOf } from "@/lib/titles";
import { getMarksOfAll } from "@/lib/universes";
import { getQueryClient, trpc } from "@/trpc/server";

/** How many results each medium shows when all four are on the page together. */
const PREVIEW_COUNT = 6;
const PLACEHOLDER_COUNT = 4;

/** Where each medium's results come from, said under its heading. */
const SOURCES: Record<MediaType, string> = {
  movie: "From TMDB",
  tv: "From TMDB",
  game: "From IGDB",
  book: "From Open Library",
};

/**
 * One medium's results. Every part of the page that needs them asks through here, and the
 * request's query client answers all but the first from what it already holds.
 */
function searchTitles(query: string, type: MediaType) {
  return getQueryClient().fetchQuery(trpc.catalog.search.queryOptions({ query, types: [type] }));
}

/** People whose username or name contains the text. The API takes at most 50 characters. */
function searchPeople(query: string) {
  return getQueryClient().fetchQuery(
    trpc.profiles.search.queryOptions({ query: query.slice(0, 50) }),
  );
}

/** Youniverses whose name contains the text. There are few enough to look through them all. */
async function searchUniverses(query: string) {
  const universes = await getQueryClient().fetchQuery(trpc.links.universes.queryOptions());
  return universes.filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()));
}

const sectionStyle = { marginTop: 36 } satisfies CSSProperties;
const headingId = (type: MediaType) => `${type}-results`;

type ResultsProps = {
  query: string;
  type: MediaType;
  /** Show only the first few, with the way to the rest: for the page that holds every medium. */
  preview: boolean;
};

/**
 * One medium's matches as a wall of cards. On the page that holds every medium, a medium with
 * no matches takes no room; on its own page it says so.
 */
export async function TitleResults({ query, type, preview }: ResultsProps) {
  const { results, unavailable } = await searchTitles(query, type);
  const { label, plural } = MEDIA[type];

  if (unavailable.length > 0) {
    return (
      <section style={sectionStyle} aria-labelledby={headingId(type)}>
        <SectionHead id={headingId(type)} title={label} />
        <p role="alert" className="note">
          <Icon name="info" size="sm" />
          <span>{label} search is unavailable right now. Try again in a minute.</span>
        </p>
      </section>
    );
  }
  if (results.length === 0) {
    if (preview) return null;
    return (
      <div className="empty" style={sectionStyle}>
        No {plural} match “{query}”. Check the spelling, or try fewer words.
      </div>
    );
  }

  const shown = preview ? results.slice(0, PREVIEW_COUNT) : results;
  const more =
    shown.length < results.length
      ? { href: searchPath(query, type), label: `See all ${results.length} ${plural}` }
      : undefined;
  return (
    <section style={sectionStyle} aria-labelledby={headingId(type)}>
      <SectionHead id={headingId(type)} title={label} sub={SOURCES[type]} more={more} />
      <Wall>
        {shown.map((result) => (
          <TitleCard
            key={result.providerId}
            title={result}
            status={result.status}
            meta={
              <>
                <YearMeta title={result} />
                {result.authors?.[0] && <span>{result.authors[0]}</span>}
              </>
            }
          />
        ))}
      </Wall>
    </section>
  );
}

/** Stands in for one medium's results while its source answers, in that medium's shape. */
export function ResultsPlaceholder({ type }: { type: MediaType }) {
  return (
    <section style={sectionStyle} aria-labelledby={headingId(type)}>
      <SectionHead id={headingId(type)} title={MEDIA[type].label} sub={SOURCES[type]} />
      <div className="wall" role="status" aria-label={`Searching ${MEDIA[type].plural}`}>
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: identical static placeholders
            key={index}
            className="card"
            style={{ "--ratio": ratioOf({ type }) } as CSSProperties}
          >
            <div className={`art art--${type} skel`} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** How many titles match, for a tab. Shows nothing while a source is unavailable. */
export async function ResultCount({ query, types }: { query: string; types: MediaType[] }) {
  const found = await Promise.all(types.map((type) => searchTitles(query, type)));
  if (found.some(({ unavailable }) => unavailable.length > 0)) return null;
  const total = found.reduce((sum, { results }) => sum + results.length, 0);
  return (
    <>
      {/* Spoken between the two, as `LinkTabs` does for a count it is given: "Movies, 9". */}
      <span className="sr-only">, </span>
      <span className="n">{total.toLocaleString("en-US")}</span>
    </>
  );
}

/**
 * Says so when no medium has a match. While a source is unavailable it stays quiet: that
 * source's own message already says what is missing.
 */
export async function NothingFound({ query }: { query: string }) {
  const [people, universes, ...found] = await Promise.all([
    searchPeople(query),
    searchUniverses(query),
    ...MEDIA_TYPES.map((type) => searchTitles(query, type)),
  ]);
  if (found.some(({ results, unavailable }) => results.length > 0 || unavailable.length > 0)) {
    return null;
  }
  return (
    <div className="empty" style={sectionStyle}>
      {people.length > 0 || universes.length > 0
        ? `No titles match “${query}”.`
        : `Nothing matches “${query}”. Check the spelling, or try fewer words.`}
    </div>
  );
}

/** Youniverses whose name matches, as tiles. Nothing when none does. */
export async function UniverseResults({ query }: { query: string }) {
  const universes = await searchUniverses(query);
  if (universes.length === 0) return null;

  const [session, { status }] = await Promise.all([
    getSession(),
    getMarksOfAll(universes.flatMap(({ titles }) => titles.map((title) => title.mediaId))),
  ]);
  return (
    <section style={sectionStyle} aria-labelledby="universe-results">
      <SectionHead id="universe-results" title="Youniverses" />
      <div className="tiles">
        {universes.map((universe) => (
          <UniverseTile
            key={universe.id}
            universe={universe}
            finished={session ? universeProgress(universe.titles, status).finished : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/** People whose username or name matches, each with a way to follow them. Nothing when nobody does. */
export async function PeopleResults({ query }: { query: string }) {
  const people = await searchPeople(query);
  if (people.length === 0) return null;

  const queryClient = getQueryClient();
  const signedIn = Boolean(await getSession());
  const [me, relations] = signedIn
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
    <section style={{ marginTop: 30 }} aria-labelledby="people-results">
      <SectionHead id="people-results" title="People" />
      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "0 40px",
        }}
      >
        {people.map(({ username, name }) => (
          <PersonRow key={username} person={{ username, name }}>
            {me?.username === username ? (
              <span className="chip">You</span>
            ) : (
              relations && (
                <FollowButton
                  username={username}
                  initiallyFollowing={relations.following.includes(username)}
                  followsYou={relations.followedBy.includes(username)}
                />
              )
            )}
          </PersonRow>
        ))}
      </ul>
    </section>
  );
}

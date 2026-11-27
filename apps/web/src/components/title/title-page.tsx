import { cn } from "cn";
import { Ambient } from "@/components/ui/ambient";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { UniverseStrip } from "@/components/universe/universe-strip";
import { usToday } from "@/lib/days";
import { mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { ambientOf, type TitleArt, tonedClass, toneStyle } from "@/lib/titles";
import { getUniverseOf } from "@/lib/universes";
import { getQueryClient, trpc } from "@/trpc/server";
import { CollectPanel } from "./collect-panel";
import { Episodes } from "./episodes";
import { type Fact, Facts } from "./facts";
import { FriendsPanel } from "./friends-panel";
import { Hero } from "./hero";
import { RatingDial } from "./rating-dial";
import { Reviews } from "./reviews";
import { WhereToBuy } from "./where-to-buy";
import { WhereToWatch } from "./where-to-watch";

/** Shown in place of a year for a title that has no date at all. */
export const NO_DATE = "Date to be announced";

type Props = {
  title: TitleArt & {
    mediaId: string;
    overview: string | null;
    /** The day it came out or comes out, when the catalog knows the day. */
    releaseDate: string | null;
  };
  /** What follows the medium in the hero's first line. Anything empty is left out. */
  meta: (string | number | null | undefined | false)[];
  /** Who made it, for a book or a game: shown under the name as "by ...". */
  by?: string | null;
  tagline?: string | null;
  facts: Fact[];
  /** For a show: the season picked in the address, if any. */
  season?: number;
};

/**
 * The page of one movie, show, game, or book: the hero with the status control, then what
 * there is to do and read about it beside its details. A title that is not out yet has a
 * countdown in place of its average, and cannot be rated or reviewed.
 */
export async function TitlePage({ title, meta, by, tagline, facts, season }: Props) {
  const { mediaId, type } = title;
  const target = { mediaId };
  const queryClient = getQueryClient();
  const session = await getSession();
  const [summary, followed, universe, entry] = await Promise.all([
    queryClient.fetchQuery(trpc.ratings.summary.queryOptions({ target })),
    queryClient.fetchQuery(trpc.ratings.fromFollowing.queryOptions({ target })),
    getUniverseOf(mediaId),
    session ? queryClient.fetchQuery(trpc.library.entry.queryOptions({ mediaId })) : null,
  ]);
  const comingOn = title.releaseDate && title.releaseDate > usToday() ? title.releaseDate : null;
  const signInHref = session
    ? null
    : `/sign-in?next=${encodeURIComponent(mediaPath(type, title.providerId))}`;

  return (
    <>
      <Ambient src={ambientOf(title)} />
      <Hero
        title={title}
        meta={meta.flatMap((item) => (item ? String(item) : []))}
        by={by || null}
        tagline={tagline || null}
        comingOn={comingOn}
        average={summary.average}
        ratingCount={summary.count}
        followed={followed}
        universe={universe}
        entry={entry}
        signInHref={signInHref}
      />
      <div className={cn("tgrid", tonedClass(title))} style={toneStyle(title)}>
        <div className="tmain">
          {!comingOn && <RatingDial target={target} />}
          <section aria-label="About">
            <p className="prose whitespace-pre-line">{title.overview ?? "No description yet."}</p>
          </section>
          {(type === "movie" || type === "tv") && (
            <section aria-labelledby="watch-h">
              <SectionHead title="Where to watch" id="watch-h" />
              <WhereToWatch
                title={{ mediaId, type, title: title.title, releaseDate: title.releaseDate }}
              />
            </section>
          )}
          {type === "game" && (
            <section aria-labelledby="buy-h">
              <SectionHead title="Where to buy" id="buy-h" />
              <WhereToBuy title={{ mediaId, title: title.title, releaseDate: title.releaseDate }} />
            </section>
          )}
          {type === "tv" && (
            <Episodes
              show={{ mediaId, providerId: title.providerId, title: title.title }}
              season={season}
            />
          )}
          <UniverseStrip mediaId={mediaId} />
          {!comingOn && <Reviews target={target} />}
        </div>
        <aside className="taside" aria-label="More about this title">
          <Facts type={type} facts={facts} />
          <FriendsPanel ratings={followed} />
          <CollectPanel title={title} signInHref={signInHref} />
          {type === "book" && (
            <div className="note">
              <Icon name="info" />
              <span>Book prices are not covered yet.</span>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

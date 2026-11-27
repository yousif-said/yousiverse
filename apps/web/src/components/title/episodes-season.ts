type Season = { seasonNumber: number; episodes: { airDate: string | null }[] };

/** Whether an episode is out, by US calendar day. One with no date announced is not. */
export function hasAired(episode: { airDate: string | null }, today: string): boolean {
  return episode.airDate !== null && episode.airDate <= today;
}

/**
 * The seasons a show's episodes section offers, in the order it offers them: numbered seasons
 * first, specials (season 0) last. A season with nothing announced yet is left out unless it
 * is the one asked for.
 */
export function seasonsToShow<S extends Season>(seasons: S[], asked: number | undefined): S[] {
  const shown = seasons.filter(
    ({ seasonNumber, episodes }) => episodes.length > 0 || seasonNumber === asked,
  );
  return [
    ...shown.filter(({ seasonNumber }) => seasonNumber > 0),
    ...shown.filter(({ seasonNumber }) => seasonNumber === 0),
  ];
}

type Choice = {
  /** The season in the page's address, when it names one. */
  asked: number | undefined;
  /** The season of the viewer's next unwatched episode, when they have started the show. */
  upTo: number | undefined;
  /** Today in the US, as YYYY-MM-DD. */
  today: string;
};

/**
 * The season the section opens on: the one asked for, else the one the viewer is up to, else
 * the latest that has started airing, else the first there is.
 */
export function openingSeason<S extends Season>(
  seasons: S[],
  { asked, upTo, today }: Choice,
): S | undefined {
  const numbered = seasons.filter(({ seasonNumber }) => seasonNumber > 0);
  return (
    seasons.find(({ seasonNumber }) => seasonNumber === asked) ??
    numbered.find(({ seasonNumber }) => seasonNumber === upTo) ??
    numbered
      .filter(({ episodes }) => episodes.some((episode) => hasAired(episode, today)))
      .at(-1) ??
    seasons[0]
  );
}

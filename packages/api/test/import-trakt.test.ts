import type { TraktTitle } from "@yousiverse/integrations/trakt";
import { describe, expect, it } from "vitest";
import { traktRows } from "../src/imports/sources/trakt";

const title = (
  values: Partial<TraktTitle> & Pick<TraktTitle, "traktId" | "title">,
): TraktTitle => ({
  type: "movie",
  year: 2000,
  tmdbId: String(values.traktId),
  imdbId: null,
  plays: null,
  airedEpisodes: null,
  rating: null,
  ...values,
});

describe("traktRows", () => {
  it("makes one row per title from the watch history, ratings, and watchlist", () => {
    const film = title({ traktId: 1, title: "Film", plays: 1 });
    const { rows, skipped } = traktRows({
      watched: [film],
      rated: [{ ...film, plays: null, rating: 7 }],
      watchlist: [title({ traktId: 2, title: "Later" }), film],
    });

    expect(skipped).toBe(0);
    expect(rows).toEqual([
      expect.objectContaining({ title: "Later", status: "want", rating: null }),
      expect.objectContaining({
        type: "movie",
        title: "Film",
        externalId: "1",
        externalKind: "tmdb",
        status: "finished",
        rating: 28,
      }),
    ]);
  });

  it("calls a show finished only once every aired episode has been played", () => {
    const show = (traktId: number, plays: number) =>
      title({ type: "tv", traktId, title: `Show ${traktId}`, plays, airedEpisodes: 10 });
    const { rows } = traktRows({
      watched: [show(1, 4), show(2, 10), show(3, 25)],
      // Rating a show does not mean it has been finished.
      rated: [{ ...show(1, 4), plays: null, rating: 10 }],
      watchlist: [],
    });

    expect(rows.map((row) => row.status)).toEqual(["in_progress", "finished", "finished"]);
    expect(rows[0]).toMatchObject({ rating: 40 });
  });

  it("counts a rated title that is not in the watch history as finished", () => {
    const { rows } = traktRows({
      watched: [],
      rated: [title({ type: "tv", traktId: 1, title: "Rated", rating: 6 })],
      watchlist: [],
    });

    expect(rows).toEqual([expect.objectContaining({ status: "finished", rating: 24 })]);
  });

  it("falls back to an IMDb id, and leaves out a title with neither id once", () => {
    const orphan = title({ traktId: 9, title: "Orphan", tmdbId: null });
    const { rows, skipped } = traktRows({
      watched: [title({ traktId: 1, title: "By IMDb", tmdbId: null, imdbId: "tt0133093" }), orphan],
      rated: [{ ...orphan, rating: 5 }],
      watchlist: [],
    });

    expect(skipped).toBe(1);
    expect(rows).toEqual([
      expect.objectContaining({ title: "By IMDb", externalId: "tt0133093", externalKind: "imdb" }),
    ]);
  });
});

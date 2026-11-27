import { describe, expect, it } from "vitest";
import {
  applyMoves,
  type BoardMoves,
  isLibrarySort,
  isLibraryView,
  libraryViewPath,
  movesStillWaiting,
  progressLine,
  withMove,
  withoutMove,
} from "./library-view";

const TODAY = "2026-11-26";

describe("libraryViewPath", () => {
  it("keeps the addresses the library has always had for type and status", () => {
    expect(libraryViewPath()).toBe("/library");
    expect(libraryViewPath({ type: "game" })).toBe("/library?type=game");
    expect(libraryViewPath({ status: "finished" })).toBe("/library?status=finished");
    expect(libraryViewPath({ type: "game", status: "finished" })).toBe(
      "/library?type=game&status=finished",
    );
  });

  it("adds the order and the view only when they are not the defaults", () => {
    expect(libraryViewPath({ sort: "recent", view: "grid" })).toBe("/library");
    expect(libraryViewPath({ sort: "rating" })).toBe("/library?sort=rating");
    expect(libraryViewPath({ type: "book", sort: "title", view: "board" })).toBe(
      "/library?type=book&sort=title&view=board",
    );
  });

  it("recognizes only the orders and views the library offers", () => {
    expect(isLibrarySort("rating")).toBe(true);
    expect(isLibrarySort("year")).toBe(false);
    expect(isLibraryView("board")).toBe(true);
    expect(isLibraryView(["board"])).toBe(false);
  });
});

describe("progressLine", () => {
  const episode = {
    seasonNumber: 2,
    episodeNumber: 7,
    name: "Chikhai Bardo",
    inSeason: 10,
    watchedInSeason: 6,
  };
  const show = (next: (typeof episode & { airDate: string | null }) | null) =>
    ({ kind: "episodes", watched: 15, total: 19, next }) as const;

  it("names the next episode of a show, measured within its season", () => {
    expect(progressLine(show({ ...episode, airDate: "2026-11-20" }), TODAY)).toEqual({
      text: "Season 2, episode 7 is next",
      percent: 60,
    });
    // One that airs today is out.
    expect(progressLine(show({ ...episode, airDate: TODAY }), TODAY).text).toBe(
      "Season 2, episode 7 is next",
    );
  });

  it("says when an episode that is not out yet airs", () => {
    expect(progressLine(show({ ...episode, airDate: "2026-11-27" }), TODAY).text).toBe(
      "Season 2, episode 7 airs tomorrow",
    );
    expect(progressLine(show({ ...episode, airDate: "2026-11-29" }), TODAY).text).toBe(
      "Season 2, episode 7 airs Sunday",
    );
    expect(progressLine(show({ ...episode, airDate: "2026-12-20" }), TODAY).text).toBe(
      "Season 2, episode 7 airs in 24 days",
    );
    expect(progressLine(show({ ...episode, airDate: null }), TODAY).text).toBe(
      "Season 2, episode 7 has no date yet",
    );
  });

  it("says a show with nothing left to watch is caught up", () => {
    expect(progressLine(show(null), TODAY)).toEqual({ text: "All caught up", percent: 100 });
  });

  it("gives a book's page against its length, when the length is known", () => {
    expect(progressLine({ kind: "pages", read: 141, of: 282 }, TODAY)).toEqual({
      text: "Page 141 of 282",
      percent: 50,
    });
    expect(progressLine({ kind: "pages", read: 141, of: null }, TODAY)).toEqual({
      text: "Page 141",
      percent: null,
    });
    // An edition longer than the catalog's never reads as more than all of it.
    expect(progressLine({ kind: "pages", read: 300, of: 282 }, TODAY).percent).toBe(100);
  });

  it("gives a game's time in hours, or minutes under an hour, with nothing to measure against", () => {
    expect(progressLine({ kind: "minutes", played: 2280 }, TODAY)).toEqual({
      text: "38 hours played",
      percent: null,
    });
    expect(progressLine({ kind: "minutes", played: 60 }, TODAY).text).toBe("1 hour played");
    expect(progressLine({ kind: "minutes", played: 45 }, TODAY).text).toBe("45 minutes played");
  });
});

describe("the board's moves", () => {
  const entries = [
    { mediaId: "a", status: "want" },
    { mediaId: "b", status: "want" },
    { mediaId: "c", status: "finished" },
  ] as const;
  const none: BoardMoves = new Map();
  const list = () => entries.map((entry) => ({ ...entry }));

  it("shows a moved title in its new column and a removed one nowhere", () => {
    const moves = withMove(withMove(none, "b", "finished"), "a", null);

    expect(applyMoves(list(), moves, "title")).toEqual([
      { mediaId: "b", status: "finished" },
      { mediaId: "c", status: "finished" },
    ]);
  });

  it("puts the title moved last first when the order is most recent", () => {
    const moves = withMove(withMove(none, "c", "want"), "b", "finished");

    expect(applyMoves(list(), moves, "recent").map((entry) => entry.mediaId)).toEqual([
      "b",
      "c",
      "a",
    ]);
    // Moving a title again makes it the latest.
    const again = withMove(moves, "c", "dropped");
    expect(applyMoves(list(), again, "recent").map((entry) => entry.mediaId)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("takes a move back when saving it failed", () => {
    const moves = withoutMove(withMove(none, "a", "finished"), "a");

    expect(applyMoves(list(), moves, "recent")).toEqual(list());
  });

  it("drops a move once the list from the server shows it, and keeps one it does not", () => {
    const moves = withMove(withMove(withMove(none, "a", "finished"), "b", null), "c", "dropped");
    const fromServer = [
      { mediaId: "a", status: "finished" },
      { mediaId: "c", status: "finished" },
    ] as const;

    expect([...movesStillWaiting(moves, [...fromServer])]).toEqual([["c", "dropped"]]);
  });

  it("keeps the same moves when none of them has been stored yet", () => {
    const moves = withMove(none, "a", "finished");

    expect(movesStillWaiting(moves, list())).toBe(moves);
  });
});

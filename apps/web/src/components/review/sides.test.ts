import { describe, expect, it } from "vitest";
import { QUEUE_RELATIONS, queueOrder, type Side, sideLabel } from "./sides";

const book: Side = {
  type: "book",
  providerId: "OL893461W",
  title: "Dune Messiah",
  releaseYear: 1969,
};
const film: Side = { type: "movie", providerId: "1170608", title: "Dune: Part Three" };

describe("queueOrder", () => {
  it("puts the source first when the stored title is the adaptation", () => {
    const suggestion = {
      kind: "adaptation_of",
      reversed: false,
      title: film,
      target: book,
    } as const;

    expect(queueOrder(suggestion)).toEqual([book, film]);
    expect(QUEUE_RELATIONS[suggestion.kind]).toBe("was adapted as");
  });

  it("puts the source first when the suggestion is about the other title", () => {
    // Reversed: the target is the adaptation of the stored title.
    const suggestion = {
      kind: "adaptation_of",
      reversed: true,
      title: book,
      target: film,
    } as const;

    expect(queueOrder(suggestion)).toEqual([book, film]);
  });

  it("puts the earlier title first for a sequel", () => {
    const first: Side = { type: "movie", providerId: "603", title: "The Matrix" };
    const second: Side = { type: "movie", providerId: "604", title: "The Matrix Reloaded" };

    expect(
      queueOrder({ kind: "sequel_of", reversed: false, title: second, target: first }),
    ).toEqual([first, second]);
    expect(QUEUE_RELATIONS.sequel_of).toBe("is followed by");
  });

  it("keeps the stored title first when the two only share a universe", () => {
    expect(
      queueOrder({ kind: "same_franchise", reversed: false, title: book, target: film }),
    ).toEqual([book, film]);
  });
});

describe("sideLabel", () => {
  it("names the medium, and the year when it is known", () => {
    expect(sideLabel(book)).toBe("Dune Messiah (book, 1969)");
    expect(sideLabel(film)).toBe("Dune: Part Three (movie)");
    expect(sideLabel({ type: "tv", providerId: "90228", title: "Dune: Prophecy" })).toBe(
      "Dune: Prophecy (TV show)",
    );
  });
});

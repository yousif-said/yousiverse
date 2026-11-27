import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { findBook, getBook, search } from "../src/open-library";
import { plainDescription, readableSubjects } from "../src/open-library/text";

describe("openLibrary.search", () => {
  it("returns books", async () => {
    expect(await search("piranesi")).toContainEqual({
      type: "book",
      providerId: "OL20893680W",
      title: "Piranesi",
      releaseYear: 2020,
      posterUrl: expect.stringMatching(/^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/),
      backdropUrl: null,
      authors: ["Susanna Clarke"],
    });
  });

  it("returns nothing when no title matches", async () => {
    expect(await search("zzzzqqqqxxxx")).toEqual([]);
  });
});

describe("openLibrary.getBook", () => {
  it("combines the work record with the search index", async () => {
    const book = await getBook("OL20893680W");

    expect(book).toMatchObject({
      providerId: "OL20893680W",
      title: "Piranesi",
      authors: ["Susanna Clarke"],
      releaseYear: 2020,
      releaseDate: null,
      posterUrl: expect.stringContaining("-L.jpg"),
    });
    expect(book.pageCount).toBeGreaterThan(100);
    expect(book.overview).toContain("Piranesi's house is no ordinary building");
    expect(book.overview).not.toContain("**");
    expect(book.genres).toContain("Labyrinths");
    expect(book.genres.some((genre) => genre.includes(":"))).toBe(false);
  });

  it("follows a work that was merged into another", async () => {
    expect(await getBook("OL893415W")).toMatchObject({ providerId: "OL893414W", title: "Dune" });
  });

  it("reports an unknown work as not found", async () => {
    const error = await getBook("OL99999999999W").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "open_library", kind: "not_found" });
  });

  it("reports an id that is not a work id as not found without calling the provider", async () => {
    await expect(getBook("../authors/OL1A")).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("plainDescription", () => {
  it("removes emphasis markers and keeps paragraphs", () => {
    expect(plainDescription("**Bold** and *italic*.\r\n\r\nSecond paragraph.")).toBe(
      "Bold and italic.\n\nSecond paragraph.",
    );
  });

  it("drops source notes and edition lists", () => {
    expect(
      plainDescription(
        "A desert planet. ([source][1])\n\n----------\nAlso contained in:\n\n - [Omnibus](https://example.com)\n\n[1]: https://example.com",
      ),
    ).toBe("A desert planet.");
  });

  it("keeps link text and drops the address", () => {
    expect(plainDescription("See [the sequel](https://example.com) next.")).toBe(
      "See the sequel next.",
    );
  });

  it("returns null for a missing or empty description", () => {
    expect(plainDescription(undefined)).toBeNull();
    expect(plainDescription("  ")).toBeNull();
  });
});

describe("readableSubjects", () => {
  it("drops compound headings and repeats", () => {
    expect(readableSubjects(["Fiction", "Fiction, general", "fiction", "Deserts"])).toEqual([
      "Fiction",
      "Deserts",
    ]);
  });

  it("drops machine tags and keeps at most six topics", () => {
    expect(
      readableSubjects([
        "form:novel",
        "Fiction",
        "nyt:fiction=2020-10-04",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
      ]),
    ).toEqual(["Fiction", "a", "b", "c", "d", "e"]);
  });
});

describe("openLibrary.findBook", () => {
  it("finds a book by its ISBN", async () => {
    expect(await findBook({ isbn: "9781635575637", title: "Piranesi", author: null })).toEqual({
      type: "book",
      providerId: "OL20893680W",
      title: "Piranesi",
      releaseYear: 2020,
      posterUrl: expect.stringMatching(/^https:\/\/covers\.openlibrary\.org\//),
      backdropUrl: null,
    });
  });

  it("falls back to an exact title with its author when there is no usable ISBN", async () => {
    expect(await findBook({ isbn: null, title: "Dune", author: "Frank Herbert" })).toMatchObject({
      providerId: "OL893414W",
      title: "Dune",
    });
    expect(
      await findBook({ isbn: "not-an-isbn", title: "Piranesi", author: "Susanna Clarke" }),
    ).toMatchObject({ providerId: "OL20893680W" });
  });

  it("does not trust an ISBN that leads to a book with a different title", async () => {
    // Open Library files this made-up ISBN under an unrelated book.
    expect(
      await findBook({ isbn: "9780000000002", title: "Zzzzqqqqxxxx", author: "Nobody" }),
    ).toBeNull();
  });

  it("finds nothing rather than guess", async () => {
    expect(await findBook({ isbn: null, title: "Zzzzqqqqxxxx", author: null })).toBeNull();
  });
});

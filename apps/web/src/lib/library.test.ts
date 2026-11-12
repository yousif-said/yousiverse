import { describe, expect, it } from "vitest";
import { libraryPath, statusLabel } from "./library";

describe("statusLabel", () => {
  it("uses the verb that fits the type of title", () => {
    expect(statusLabel("want", "book")).toBe("Want to read");
    expect(statusLabel("want", "game")).toBe("Want to play");
    expect(statusLabel("in_progress", "tv")).toBe("Watching");
    expect(statusLabel("in_progress", "book")).toBe("Reading");
  });

  it("uses the same word for every type once a title is finished or dropped", () => {
    expect(statusLabel("finished", "movie")).toBe("Finished");
    expect(statusLabel("dropped", "game")).toBe("Dropped");
  });
});

describe("libraryPath", () => {
  it("includes only the filters that are set", () => {
    expect(libraryPath()).toBe("/library");
    expect(libraryPath("game")).toBe("/library?type=game");
    expect(libraryPath(undefined, "finished")).toBe("/library?status=finished");
    expect(libraryPath("book", "in_progress")).toBe("/library?type=book&status=in_progress");
  });
});

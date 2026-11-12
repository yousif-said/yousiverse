import { describe, expect, it } from "vitest";
import { formatDate, formatRuntime, pluralize } from "./format";

describe("formatDate", () => {
  it("keeps the calendar day regardless of time zone", () => {
    expect(formatDate("1999-03-31")).toBe("March 31, 1999");
    expect(formatDate("2022-01-01")).toBe("January 1, 2022");
  });
});

describe("formatRuntime", () => {
  it.each([
    [45, "45m"],
    [60, "1h"],
    [136, "2h 16m"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });
});

describe("pluralize", () => {
  it("uses the singular only for one", () => {
    expect(pluralize(1, "episode")).toBe("1 episode");
    expect(pluralize(0, "episode")).toBe("0 episodes");
    expect(pluralize(9, "episode")).toBe("9 episodes");
  });
});

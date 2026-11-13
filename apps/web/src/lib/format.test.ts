import { describe, expect, it } from "vitest";
import {
  formatAverageRating,
  formatDate,
  formatPrice,
  formatRating,
  formatRuntime,
  pluralize,
} from "./format";

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

describe("formatPrice", () => {
  it.each([
    [499, "$4.99"],
    [1000, "$10.00"],
    [0, "$0.00"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatPrice(cents)).toBe(expected);
  });
});

describe("pluralize", () => {
  it("uses the singular only for one", () => {
    expect(pluralize(1, "episode")).toBe("1 episode");
    expect(pluralize(0, "episode")).toBe("0 episodes");
    expect(pluralize(9, "episode")).toBe("9 episodes");
  });
});

describe("formatRating", () => {
  it.each([
    [0, "0"],
    [1, "0.25"],
    [30, "7.5"],
    [33, "8.25"],
    [40, "10"],
  ])("shows %i quarter points as %s", (quarterPoints, expected) => {
    expect(formatRating(quarterPoints)).toBe(expected);
  });
});

describe("formatAverageRating", () => {
  it.each([
    [33, "8.25"],
    [35.5, "8.88"],
    [31.333333, "7.83"],
    [32, "8"],
  ])("shows an average of %d quarter points as %s", (quarterPoints, expected) => {
    expect(formatAverageRating(quarterPoints)).toBe(expected);
  });
});

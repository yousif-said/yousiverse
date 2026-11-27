import { describe, expect, it } from "vitest";
import { agoLabel, dayOf, daysBetween, midSentence, shortDate, untilLabel } from "./days";

const TODAY = "2026-11-26";

describe("daysBetween", () => {
  it("counts whole calendar days, negative when the second day is earlier", () => {
    expect(daysBetween("2026-11-26", "2026-12-03")).toBe(7);
    expect(daysBetween("2026-11-26", "2026-11-25")).toBe(-1);
    // Across the end of daylight saving time, when a day is 25 hours long.
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("dayOf", () => {
  it("names the US calendar day a moment fell on, not the UTC one", () => {
    expect(dayOf(new Date("2026-11-27T03:30:00Z"))).toBe("2026-11-26");
    expect(dayOf(new Date("2026-11-27T12:00:00Z"))).toBe("2026-11-27");
  });
});

describe("agoLabel", () => {
  it("names recent days by word and older ones by date", () => {
    expect(agoLabel("2026-11-26", TODAY)).toBe("Today");
    expect(agoLabel("2026-11-25", TODAY)).toBe("Yesterday");
    expect(agoLabel("2026-11-23", TODAY)).toBe("Monday");
    expect(agoLabel("2026-11-03", TODAY)).toBe("Nov 3");
  });

  it("adds the year once it is not this one", () => {
    expect(agoLabel("2025-11-03", TODAY)).toBe("Nov 3, 2025");
  });
});

describe("untilLabel", () => {
  it("names the coming week by word and later days by how far off they are", () => {
    expect(untilLabel("2026-11-26", TODAY)).toBe("Today");
    expect(untilLabel("2026-11-27", TODAY)).toBe("Tomorrow");
    expect(untilLabel("2026-11-28", TODAY)).toBe("Saturday");
    expect(untilLabel("2026-12-08", TODAY)).toBe("In 12 days");
  });
});

describe("midSentence", () => {
  it("lowercases a relative day and leaves weekday and month names alone", () => {
    expect(midSentence("Tomorrow")).toBe("tomorrow");
    expect(midSentence("In 12 days")).toBe("in 12 days");
    expect(midSentence("Saturday")).toBe("Saturday");
    expect(midSentence("Nov 3")).toBe("Nov 3");
  });
});

describe("shortDate", () => {
  it("keeps the day a calendar date names, whatever the viewer's time zone", () => {
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});

import { describe, expect, it } from "vitest";
import { byDay } from "./by-day";

describe("byDay", () => {
  it("groups by the US calendar day rather than the UTC one, keeping the order", () => {
    const lateEvening = { id: 1, at: "2026-11-26T04:30:00Z" };
    const evening = { id: 2, at: new Date("2026-11-26T01:00:00Z") };
    const dayBefore = { id: 3, at: "2026-11-25T03:00:00Z" };

    expect(byDay([lateEvening, evening, dayBefore])).toEqual([
      { day: "2026-11-25", items: [lateEvening, evening] },
      { day: "2026-11-24", items: [dayBefore] },
    ]);
  });

  it("has no days when nothing happened", () => {
    expect(byDay([])).toEqual([]);
  });
});

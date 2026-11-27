import { describe, expect, it } from "vitest";
import { priceScale, suggestedTarget } from "./offers-prices";

describe("suggestedTarget", () => {
  it("suggests a fifth under today's price, ending in 99 cents", () => {
    expect(suggestedTarget(2249)).toBe(1799);
    expect(suggestedTarget(999)).toBe(799);
    expect(suggestedTarget(5999)).toBe(4799);
  });

  it("suggests nothing when that would not be cheaper than today's price", () => {
    expect(suggestedTarget(99)).toBeNull();
    expect(suggestedTarget(49)).toBeNull();
    expect(suggestedTarget(0)).toBeNull();
  });
});

describe("priceScale", () => {
  it("runs from a little under the lowest price marked up to the usual price", () => {
    const at = priceScale([2249, 2999], 2999);

    expect(at?.(2999)).toBe(96);
    expect(at?.(2249)).toBeCloseTo(23.07, 1);
  });

  it("puts a lower price further left", () => {
    const at = priceScale([4199, 3999, 4799], 5999);

    expect(at?.(3999)).toBeLessThan(at?.(4199) ?? 0);
    expect(at?.(4199)).toBeLessThan(at?.(4799) ?? 0);
  });

  it("keeps every price clear of the ends of the bar", () => {
    const at = priceScale([100], 6000);

    expect(at?.(100)).toBe(4);
    expect(at?.(9000)).toBe(96);
  });

  it("has no bar for a game that costs nothing or has no prices marked", () => {
    expect(priceScale([0], 0)).toBeNull();
    expect(priceScale([], 2999)).toBeNull();
  });
});

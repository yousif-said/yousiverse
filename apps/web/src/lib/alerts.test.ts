import { describe, expect, it } from "vitest";
import {
  alertCondition,
  parseDollars,
  priceBarPositions,
  removeAlertLabel,
  sentenceCase,
  waitingFor,
} from "./alerts";

describe("alertCondition", () => {
  it("says what each kind of alert waits for", () => {
    expect(alertCondition("on_my_subscriptions", null)).toBe("it is on one of your subscriptions");
    expect(alertCondition("streamable", null)).toBe("it can be streamed");
    expect(alertCondition("price_at_most", 999)).toBe("it costs $9.99 or less");
    expect(alertCondition("price_at_most", null)).toBe("its price drops");
  });
});

describe("waitingFor", () => {
  it("says what a waiting alert waits for, as a line under its title", () => {
    expect(waitingFor("price_at_most", 3999, [])).toBe("$39.99 or less at a PC store");
    expect(waitingFor("price_at_most", null, [])).toBe("A lower price at a PC store");
    expect(waitingFor("streamable", null, ["Netflix"])).toBe(
      "Streaming anywhere, on a subscription or free",
    );
  });

  it("names the person's subscriptions, the first few when there are many", () => {
    expect(waitingFor("on_my_subscriptions", null, ["Netflix", "HBO Max"])).toBe(
      "On Netflix, HBO Max",
    );
    expect(
      waitingFor("on_my_subscriptions", null, ["Netflix", "HBO Max", "Hulu", "Peacock", "Mubi"]),
    ).toBe("On Netflix, HBO Max, Hulu, and 2 more");
    expect(waitingFor("on_my_subscriptions", null, [])).toBe("On one of your subscriptions");
  });
});

describe("removeAlertLabel", () => {
  it("names the title and what the alert waits for", () => {
    expect(removeAlertLabel("Hades", "price_at_most", 999)).toBe(
      "Remove the alert on Hades for when it costs $9.99 or less",
    );
    expect(removeAlertLabel("Dune", "streamable", null)).toBe(
      "Remove the alert on Dune for when it can be streamed",
    );
  });
});

describe("priceBarPositions", () => {
  it("places the lowest price, the target, and today's price from left to right", () => {
    const at = priceBarPositions({ nowCents: 4799, regularCents: 5999, lowestCents: 4199 }, 3999);

    expect(at.target).toBeLessThan(at.lowest ?? 0);
    expect(at.lowest ?? 0).toBeLessThan(at.now);
    // The bar starts 10% under the lowest price shown and ends at the usual price.
    expect(at.target).toBeCloseTo(((3999 - 3599.1) / (5999 - 3599.1)) * 100);
    expect(at.now).toBeCloseTo(((4799 - 3599.1) / (5999 - 3599.1)) * 100);
  });

  it("keeps every mark off the very ends of the bar", () => {
    const at = priceBarPositions({ nowCents: 5999, regularCents: 5999, lowestCents: 100 }, 50);

    expect(at.now).toBe(96);
    expect(at.target).toBe(4);
  });

  it("leaves out the lowest price when it is not known, and never divides by nothing", () => {
    expect(
      priceBarPositions({ nowCents: 1000, regularCents: 1000, lowestCents: null }, 500),
    ).toEqual({ now: 96, target: expect.closeTo(9.09, 1), lowest: null });
    const flat = priceBarPositions({ nowCents: 0, regularCents: 0, lowestCents: 0 }, 0);
    expect(Object.values(flat).every(Number.isFinite)).toBe(true);
  });
});

describe("parseDollars", () => {
  it("reads whole and decimal amounts, with or without a dollar sign", () => {
    expect(parseDollars("9.99")).toBe(999);
    expect(parseDollars("$9.99")).toBe(999);
    expect(parseDollars(" 10 ")).toBe(1000);
    expect(parseDollars("7.5")).toBe(750);
    expect(parseDollars("$ 0.05")).toBe(5);
  });

  it("answers null for anything that is not an amount above zero", () => {
    for (const text of ["", "free", "0", "0.00", "-5", "9.999", "1,000", "12345", "9.", "$"]) {
      expect(parseDollars(text)).toBeNull();
    }
  });
});

describe("sentenceCase", () => {
  it("capitalises the first letter only", () => {
    expect(sentenceCase("now $9.99 at Steam")).toBe("Now $9.99 at Steam");
    expect(sentenceCase("")).toBe("");
  });
});

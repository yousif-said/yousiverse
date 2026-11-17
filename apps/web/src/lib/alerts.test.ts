import { describe, expect, it } from "vitest";
import { alertCondition, parseDollars, sentenceCase } from "./alerts";

describe("alertCondition", () => {
  it("says what each kind of alert waits for", () => {
    expect(alertCondition("on_my_subscriptions", null)).toBe("it is on one of your subscriptions");
    expect(alertCondition("streamable", null)).toBe("it can be streamed");
    expect(alertCondition("price_at_most", 999)).toBe("it costs $9.99 or less");
    expect(alertCondition("price_at_most", null)).toBe("its price drops");
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

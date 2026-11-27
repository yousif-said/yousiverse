import { describe, expect, it } from "vitest";
import { ratingAfterKey, ratingAlong } from "./rating-dial-scale";

describe("ratingAlong", () => {
  it("turns a place on the scale into the nearest quarter point", () => {
    expect(ratingAlong(0)).toBe(0);
    expect(ratingAlong(0.5)).toBe(20);
    expect(ratingAlong(0.825)).toBe(33);
    expect(ratingAlong(0.83)).toBe(33);
    expect(ratingAlong(1)).toBe(40);
  });

  it("stops at the ends when the pointer is dragged past them", () => {
    expect(ratingAlong(-0.3)).toBe(0);
    expect(ratingAlong(1.4)).toBe(40);
  });
});

describe("ratingAfterKey", () => {
  it("moves a quarter point with the arrow keys", () => {
    expect(ratingAfterKey("ArrowRight", 33)).toBe(34);
    expect(ratingAfterKey("ArrowUp", 33)).toBe(34);
    expect(ratingAfterKey("ArrowLeft", 33)).toBe(32);
    expect(ratingAfterKey("ArrowDown", 33)).toBe(32);
  });

  it("moves a whole point with Page Up and Page Down", () => {
    expect(ratingAfterKey("PageUp", 33)).toBe(37);
    expect(ratingAfterKey("PageDown", 33)).toBe(29);
  });

  it("goes to either end with Home and End", () => {
    expect(ratingAfterKey("Home", 33)).toBe(0);
    expect(ratingAfterKey("End", 33)).toBe(40);
    expect(ratingAfterKey("End", null)).toBe(40);
  });

  it("never leaves the scale", () => {
    expect(ratingAfterKey("ArrowRight", 40)).toBe(40);
    expect(ratingAfterKey("PageUp", 38)).toBe(40);
    expect(ratingAfterKey("ArrowLeft", 0)).toBe(0);
    expect(ratingAfterKey("PageDown", 2)).toBe(0);
  });

  it("starts from the middle when nothing is rated yet", () => {
    expect(ratingAfterKey("ArrowRight", null)).toBe(21);
    expect(ratingAfterKey("ArrowLeft", null)).toBe(19);
  });

  it("leaves every other key alone", () => {
    expect(ratingAfterKey("Tab", 33)).toBeNull();
    expect(ratingAfterKey("a", null)).toBeNull();
  });
});

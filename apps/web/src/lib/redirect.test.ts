import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirectPath("/account")).toBe("/account");
    expect(safeRedirectPath("/lists?sort=recent")).toBe("/lists?sort=recent");
  });

  it("falls back to the home page when there is no path", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "account",
  ])("rejects %s", (path) => {
    expect(safeRedirectPath(path)).toBe("/");
  });
});

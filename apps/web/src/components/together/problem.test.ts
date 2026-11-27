import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { problemFrom } from "./problem";

const refusal = (code: string, message: string) =>
  TRPCClientError.from({ error: { message, code: -32000, data: { code } } });

describe("problemFrom", () => {
  it("passes on the API's words when it asks the person for something they can do", () => {
    const error = refusal("PRECONDITION_FAILED", "Choose a username on your account page first.");

    expect(problemFrom(error, "Not saved.")).toBe("Choose a username on your account page first.");
  });

  it("keeps to its own words for every other failure", () => {
    expect(
      problemFrom(refusal("INTERNAL_SERVER_ERROR", "relation does not exist"), "Not saved."),
    ).toBe("Not saved.");
    expect(problemFrom(new TypeError("Failed to fetch"), "Not saved.")).toBe("Not saved.");
  });
});

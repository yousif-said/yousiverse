import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requestJson } from "../src/http";

const url = new URL("https://provider.example/items/1?api_key=secret");
const schema = z.object({ id: z.number() });

function respondWith(response: Response | Error) {
  vi.stubEnv("PROVIDER_FIXTURES", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  it("returns validated data", async () => {
    respondWith(Response.json({ id: 1, extra: true }));
    expect(await requestJson("tmdb", url, schema)).toEqual({ id: 1 });
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    respondWith(Response.json({}, { status }));
    await expect(requestJson("tmdb", url, schema)).rejects.toMatchObject({ kind });
  });

  it("reports a network failure as unavailable", async () => {
    respondWith(new TypeError("fetch failed"));
    await expect(requestJson("tmdb", url, schema)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("rejects data that does not match the schema", async () => {
    respondWith(Response.json({ id: "one" }));
    await expect(requestJson("tmdb", url, schema)).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("keeps credentials in the query string out of error messages", async () => {
    respondWith(Response.json({}, { status: 500 }));
    const error = await requestJson("tmdb", url, schema).catch((caught: Error) => caught);
    expect((error as Error).message).not.toContain("secret");
  });
});

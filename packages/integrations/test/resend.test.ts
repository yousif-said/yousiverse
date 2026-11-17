import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../src/resend";

const EMAIL = { to: "ada@example.com", subject: "Hello", html: "<p>Hello</p>", text: "Hello" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resend.sendEmail", () => {
  it("never sends anything in tests: every email gets the recorded answer", async () => {
    expect(await sendEmail(EMAIL)).toBe("fixture-email");
    expect(await sendEmail({ ...EMAIL, to: "grace@example.com" })).toBe("fixture-email");
  });

  it("posts the email from the app's own address, with the key in a header", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init?: RequestInit) => Response.json({ id: "abc" }));
    vi.stubEnv("PROVIDER_FIXTURES", "false");
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmail(EMAIL)).toBe("abc");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Yousiverse <test@yousiverse.test>",
      ...EMAIL,
    });
  });

  it("reports a refusal as a provider error that does not carry the key", async () => {
    vi.stubEnv("PROVIDER_FIXTURES", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "bad" }, { status: 422 })),
    );

    const error = await sendEmail(EMAIL).catch((caught) => caught);

    expect(error).toMatchObject({ provider: "resend", kind: "unavailable" });
    expect(String(error.message)).not.toContain("test-key");
  });
});

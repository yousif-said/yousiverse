import { describe, expect, it } from "vitest";
import { renderEmail } from "../src/layout";

const SIGN_IN = {
  subject: "Your sign-in link",
  heading: "Sign in",
  paragraphs: ["Use the button below.", "It works once."],
  action: { label: "Sign in", url: "https://yousiverse.com/api/auth/verify?token=abc&next=%2F" },
  footnotes: [{ text: "If you did not ask for this, ignore it." }],
};

describe("renderEmail", () => {
  it("builds the same message as HTML and as text", () => {
    const { subject, html, text } = renderEmail(SIGN_IN);

    expect(subject).toBe("Your sign-in link");
    expect(html).toContain("<h1");
    expect(html).toContain("Use the button below.");
    expect(html).toContain('href="https://yousiverse.com/api/auth/verify?token=abc&amp;next=%2F"');
    expect(text).toBe(
      [
        "Sign in",
        "Use the button below.",
        "It works once.",
        "Sign in: https://yousiverse.com/api/auth/verify?token=abc&next=%2F",
        "If you did not ask for this, ignore it.",
      ].join("\n\n"),
    );
  });

  it("treats everything it is given as text, never as markup", () => {
    const { html } = renderEmail({
      subject: "A <b>subject</b>",
      heading: 'Tom & "Jerry"',
      paragraphs: ["<script>alert(1)</script>"],
      items: [{ text: "<img src=x onerror=alert(1)>", url: 'https://example.com/?a="><script>' }],
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("Tom &amp; &quot;Jerry&quot;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('href="https://example.com/?a=&quot;&gt;&lt;script&gt;"');
  });

  it("lists items, linking the ones that have an address", () => {
    const { html, text } = renderEmail({
      subject: "News",
      heading: "What changed",
      paragraphs: [],
      items: [
        { text: "Hades is $9.99", url: "https://yousiverse.com/games/113112" },
        { text: "Nothing else" },
      ],
      footnotes: [
        {
          text: "Stop these emails:",
          url: "https://yousiverse.com/alerts",
          linkLabel: "your alerts",
        },
      ],
    });

    expect(html).toContain('<li><a href="https://yousiverse.com/games/113112"');
    expect(html).toContain("<li>Nothing else</li>");
    expect(html).toContain(">your alerts</a>");
    expect(text).toContain("- Hades is $9.99: https://yousiverse.com/games/113112\n- Nothing else");
    expect(text).toContain("Stop these emails: https://yousiverse.com/alerts");
  });

  it("leaves out the button and the list when there are none", () => {
    const { html } = renderEmail({ subject: "Hi", heading: "Hi", paragraphs: ["Hello."] });

    expect(html).not.toContain("<ul");
    expect(html).not.toContain("If the button does not work");
  });
});

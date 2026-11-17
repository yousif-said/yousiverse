export type EmailContent = { subject: string; html: string; text: string };

export type EmailParts = {
  subject: string;
  heading: string;
  /** Plain sentences shown above the button. */
  paragraphs: string[];
  /** Lines listed under the paragraphs, each optionally a link. */
  items?: { text: string; url?: string }[];
  action?: { label: string; url: string };
  /** Small print at the bottom: why the person got this email, how to stop it. */
  footnotes?: { text: string; url?: string; linkLabel?: string }[];
};

const COLORS = { text: "#171a2e", muted: "#5b607a", primary: "#3a32e0", page: "#f4f5fa" };
const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const link = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:${COLORS.primary}">${escapeHtml(label)}</a>`;

/**
 * Builds one email in the app's plain style, as HTML and as text. Everything passed in is
 * treated as text, never as markup, so a title or name cannot inject anything.
 */
export function renderEmail(parts: EmailParts): EmailContent {
  const { subject, heading, paragraphs, items = [], action, footnotes = [] } = parts;
  const paragraphStyle = `margin:0 0 16px;font-size:16px;line-height:24px;color:${COLORS.text}`;

  const html = [
    "<!doctype html>",
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}"><tr><td align="center" style="padding:32px 16px">`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px"><tr><td style="padding:32px">',
    `<p style="margin:0 0 24px;font-size:14px;font-weight:700;color:${COLORS.muted}">Yousiverse</p>`,
    `<h1 style="margin:0 0 16px;font-size:24px;line-height:30px;color:${COLORS.text}">${escapeHtml(heading)}</h1>`,
    ...paragraphs.map((text) => `<p style="${paragraphStyle}">${escapeHtml(text)}</p>`),
    items.length > 0
      ? `<ul style="margin:0 0 16px;padding:0 0 0 20px;font-size:16px;line-height:24px;color:${COLORS.text}">${items
          .map((item) => `<li>${item.url ? link(item.url, item.text) : escapeHtml(item.text)}</li>`)
          .join("")}</ul>`
      : "",
    action
      ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${COLORS.primary};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none">${escapeHtml(action.label)}</a></p>` +
        `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${COLORS.muted}">If the button does not work, copy this address into your browser:<br>${link(action.url, action.url)}</p>`
      : "",
    ...footnotes.map(
      (note) =>
        `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted}">${escapeHtml(note.text)}${note.url ? ` ${link(note.url, note.linkLabel ?? note.url)}` : ""}</p>`,
    ),
    "</td></tr></table></td></tr></table></body></html>",
  ].join("");

  const text = [
    heading,
    ...paragraphs,
    ...(items.length > 0
      ? [items.map((item) => `- ${item.text}${item.url ? `: ${item.url}` : ""}`).join("\n")]
      : []),
    ...(action ? [`${action.label}: ${action.url}`] : []),
    ...footnotes.map((note) => `${note.text}${note.url ? ` ${note.url}` : ""}`),
  ].join("\n\n");

  return { subject, html, text };
}

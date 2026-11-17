import type { MediaType } from "@yousiverse/db/schema";
import { type EmailContent, renderEmail } from "@yousiverse/email";
import { titlePath } from "../catalog/paths";

export type AlertNews = {
  title: string;
  type: MediaType;
  providerId: string;
  /** What was found, as a clause: "now $9.99 at Steam". */
  outcome: string;
};

/** One email telling a person about every alert of theirs that came through. */
export function alertsEmail(
  news: AlertNews[],
  links: { origin: string; unsubscribeToken: string },
): EmailContent {
  const sentences = news.map((item) => `${item.title} is ${item.outcome}`);
  const [only] = sentences;
  return renderEmail({
    subject:
      news.length === 1 && only ? only : `${news.length} of your Yousiverse alerts came through`,
    heading: news.length === 1 ? "Your alert came through" : "Your alerts came through",
    paragraphs: ["Prices and availability are for the US and can change quickly."],
    items: news.map((item, index) => ({
      text: sentences[index] ?? item.title,
      url: `${links.origin}${titlePath(item.type, item.providerId)}`,
    })),
    action: { label: "See your alerts", url: `${links.origin}/alerts` },
    footnotes: [
      { text: "You are getting this because you set these alerts on Yousiverse." },
      {
        text: "To stop alert emails:",
        url: `${links.origin}/alerts/unsubscribe?token=${encodeURIComponent(links.unsubscribeToken)}`,
        linkLabel: "unsubscribe",
      },
    ],
  });
}

import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Icon } from "@/components/ui/icon";
import { type MyAlert, removeAlertLabel, waitingFor } from "@/lib/alerts";
import { agoLabel, dayOf, midSentence, shortDate, usToday } from "@/lib/days";
import { formatDate, formatPrice } from "@/lib/format";
import { type MediaType, mediaPath } from "@/lib/media";
import { PriceBar } from "./price-bar";
import { RemoveAlertButton } from "./remove-alert-button";

type Props = {
  alert: MyAlert;
  /** The services the person subscribes to, which an alert on them names. */
  subscriptions: string[];
};

const RELEASE_WORDS: Record<MediaType, string> = {
  movie: "Opens",
  tv: "Starts",
  game: "Out",
  book: "Out",
};

/** How things stand for an alert with no price to show: not out yet, or when it was last checked. */
function standing(alert: MyAlert): string {
  const today = usToday();
  const { releaseDate, type } = alert.title;
  if (releaseDate && releaseDate > today) {
    const sameYear = releaseDate.slice(0, 4) === today.slice(0, 4);
    return `${RELEASE_WORDS[type]} ${sameYear ? shortDate(releaseDate) : formatDate(releaseDate)}`;
  }
  if (!alert.checkedAt) return "Not checked yet";
  return `Checked ${midSentence(agoLabel(dayOf(new Date(alert.checkedAt)), today))}`;
}

/** An alert still waiting: its title, what it waits for, and how far off that is. */
export function WaitingRow({ alert, subscriptions }: Props) {
  const { title, kind, targetCents, price } = alert;

  return (
    <li className="wait">
      <Thumb title={title} decorative />
      <div className="min-w-0">
        <Link
          className="row__title block"
          href={mediaPath(title.type, title.providerId)}
          style={{ fontSize: 15.5 }}
        >
          {title.title}
        </Link>
        <div className="row__sub">
          <Icon name={kind === "price_at_most" ? "tag" : "play"} size="sm" />
          <span>{waitingFor(kind, targetCents, subscriptions)}</span>
        </div>
      </div>
      {price && targetCents !== null ? (
        <div>
          <div className="hint">
            Now{" "}
            <b className="mono" style={{ color: "var(--fg)" }}>
              {formatPrice(price.nowCents)}
            </b>
            ,{" "}
            {price.nowCents > targetCents
              ? `${formatPrice(price.nowCents - targetCents)} to go`
              : "at your price"}
          </div>
          <PriceBar price={price} targetCents={targetCents} />
        </div>
      ) : (
        <div className="hint">{standing(alert)}</div>
      )}
      <RemoveAlertButton
        alertId={alert.id}
        label={removeAlertLabel(title.title, kind, targetCents)}
      />
    </li>
  );
}

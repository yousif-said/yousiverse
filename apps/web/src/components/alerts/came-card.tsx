import { cn } from "cn";
import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Icon } from "@/components/ui/icon";
import { removeAlertLabel, sentenceCase } from "@/lib/alerts";
import { agoLabel, dayOf, midSentence } from "@/lib/days";
import { mediaPath } from "@/lib/media";
import { type TitleArt, tonedClass, toneStyle } from "@/lib/titles";
import { RemoveAlertButton } from "./remove-alert-button";

export type CameThrough = {
  id: string;
  kind: "on_my_subscriptions" | "streamable" | "price_at_most";
  /** What was found, in words ready to show: "On Netflix", "$22.49 at Fanatical". */
  outcome: string | null;
  triggeredAt: Date | null;
  title: TitleArt & { mediaId: string };
};

type Props = {
  alert: CameThrough;
  /** Adds a way to remove the alert, for the page that lists them all. */
  removable?: boolean;
};

/** An alert that came through: the title, what happened, and the one thing to do about it. */
export function CameCard({ alert, removable = false }: Props) {
  const { title, kind } = alert;
  const href = mediaPath(title.type, title.providerId);
  const isPrice = kind === "price_at_most";
  const when = alert.triggeredAt && midSentence(agoLabel(dayOf(new Date(alert.triggeredAt))));
  const open = (
    <Link className="btn btn--sm btn--tone" href={href}>
      <Icon name={isPrice ? "tag" : "play"} size="sm" />
      {isPrice ? "See the deal" : "See where to watch"}
    </Link>
  );

  return (
    <div className={cn("came", tonedClass(title))} style={toneStyle(title)}>
      <Thumb title={title} decorative />
      <div className="min-w-0">
        <div className="came__t">
          <Link href={href}>{title.title}</Link>
        </div>
        <div className="came__s">
          {alert.outcome ? sentenceCase(alert.outcome) : "Came through"}
          {when && ` · ${when}`}
        </div>
        {removable ? (
          <div className="came__acts">
            {open}
            <RemoveAlertButton
              alertId={alert.id}
              label={removeAlertLabel(title.title, kind, null)}
            />
          </div>
        ) : (
          open
        )}
      </div>
    </div>
  );
}

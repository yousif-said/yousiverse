import type { RouterOutputs } from "@yousiverse/api";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import { MEDIA } from "@/lib/media";
import { averageLabel, histogramLabel } from "@/lib/profile";

type Props = {
  stats: RouterOutputs["profiles"]["stats"];
  /** Whose ratings these are, ready to follow "How": "you rate", "Mara rates". */
  rater: string;
};

/** A person's taste at a glance: how much of each medium, and how they spread their ratings. */
export function TasteStrip({ stats, rater }: Props) {
  const { count, average, histogram } = stats.ratings;
  const peak = Math.max(...histogram, 1);
  const bars = histogram.map((ratings, halfPoints) => ({ at: halfPoints / 2, ratings }));

  return (
    <div className="taste">
      {stats.media.map((medium) => (
        <div key={medium.type}>
          <span className={`med med--${medium.type}`}>
            <Icon name={MEDIA[medium.type].icon} size="sm" />
            {MEDIA[medium.type].label}
          </span>
          <b>{medium.titles.toLocaleString("en-US")}</b>
          <small>average {averageLabel(medium.average)}</small>
        </div>
      ))}
      <div>
        <span className="label">How {rater}</span>
        <div className="histo" role="img" aria-label={histogramLabel(histogram)}>
          {bars.map((bar) => (
            <i key={bar.at} style={{ height: `${Math.max(4, (bar.ratings / peak) * 100)}%` }} />
          ))}
        </div>
        <div className="histo__ax" aria-hidden="true">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
        <small>
          {pluralize(count, "rating")}, average {averageLabel(average)}
        </small>
      </div>
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { formatRating } from "@/lib/format";
import { MEDIA } from "@/lib/media";
import { RatingControl } from "./rating-control";

type Props = { episodeId: string; episodeNumber: number; mine: number | null };

/**
 * A button in an episode's row showing the signed-in person's rating, which opens the rating
 * slider underneath. Rendered inside the row's grid: the button takes the last column.
 */
export function EpisodeRating({ episodeId, episodeNumber, mine }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          mine === null
            ? `Rate episode ${episodeNumber}`
            : `Your rating of episode ${episodeNumber}: ${formatRating(mine)}`
        }
        data-rated={mine !== null || undefined}
        onClick={() => setOpen(!open)}
        className="h-fit min-w-14 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium tabular-nums outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 data-rated:border-tv data-rated:bg-tv data-rated:text-tv-foreground"
      >
        {mine === null ? "Rate" : formatRating(mine)}
      </button>
      {open && (
        <div id={panelId} className="col-span-2 col-start-2 mt-4 max-w-xl">
          <RatingControl target={{ episodeId }} initialValue={mine} accent={MEDIA.tv.accent} />
        </div>
      )}
    </>
  );
}

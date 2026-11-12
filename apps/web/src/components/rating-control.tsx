"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { formatRating } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

type Props = {
  target: { mediaId: string } | { episodeId: string };
  initialValue: number | null;
  /** Tailwind accent class for the slider, so it takes the color of the title's medium. */
  accent: string;
};

const MAX_RATING = 40;
const SAVE_DELAY_MS = 400;

/** Rates a title or an episode out of 10 in quarter-point steps. Ratings save on their own. */
export function RatingControl({ target, initialValue, accent }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const sliderId = useId();
  const [value, setValue] = useState(initialValue);
  const [failed, setFailed] = useState(false);
  const stored = useRef(initialValue);
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = useMutation(trpc.ratings.save.mutationOptions());
  const remove = useMutation(trpc.ratings.remove.mutationOptions());

  async function store(next: number | null) {
    try {
      if (next === null) await remove.mutateAsync({ target });
      else await save.mutateAsync({ target, value: next });
      stored.current = next;
      router.refresh();
    } catch {
      setValue(stored.current);
      setFailed(true);
    }
  }

  // Dragging the slider passes through many values; only the one it rests on is saved.
  function change(next: number | null) {
    setValue(next);
    setFailed(false);
    clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => store(next), next === null ? 0 : SAVE_DELAY_MS);
  }

  return (
    <div>
      <div className="flex items-baseline gap-6">
        <label htmlFor={sliderId} className="text-sm text-muted-foreground">
          Your rating
        </label>
        {value !== null && (
          <button
            type="button"
            onClick={() => change(null)}
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Clear rating
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-5">
        <output
          htmlFor={sliderId}
          className="w-24 shrink-0 font-display text-4xl leading-none font-extrabold tabular-nums"
        >
          {value === null ? <span className="text-muted-foreground">–</span> : formatRating(value)}
        </output>
        <div className="min-w-0 flex-1">
          <input
            id={sliderId}
            type="range"
            min={0}
            max={MAX_RATING}
            step={1}
            value={value ?? 0}
            onChange={(event) => change(Number(event.target.value))}
            aria-valuetext={value === null ? "Not rated" : `${formatRating(value)} out of 10`}
            className={cn(
              "block w-full rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              accent,
              value === null && "opacity-60",
            )}
          />
          <div
            aria-hidden="true"
            className="mt-1 flex justify-between px-1 text-xs text-muted-foreground tabular-nums"
          >
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Your rating could not be saved. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

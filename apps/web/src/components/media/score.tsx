import { cn } from "cn";
import type { CSSProperties } from "react";
import { formatRating } from "@/lib/format";

/** The ring used for every rating and every measure of progress. `value` is 0 to 100. */
export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <i
      className={cn("meter", className)}
      aria-hidden="true"
      style={{ "--v": Math.min(100, Math.max(0, value)) } as CSSProperties}
    />
  );
}

type ScoreProps = {
  /** Quarter points, 0 to 40. Nothing is drawn for a title that is not rated. */
  value: number | null | undefined;
  large?: boolean;
};

/** The signed-in person's own rating of something, at full strength. */
export function Score({ value, large }: ScoreProps) {
  if (value == null) return null;
  return (
    <span className={cn("score score--mine", large && "score--lg")} title="Your rating">
      <Meter value={(value / 40) * 100} />
      <span className="sr-only">Your rating: </span>
      {formatRating(value)}
    </span>
  );
}

/** Everyone's average, dimmed so it never reads as yours. `value` is in quarter points. */
export function Average({ value, large }: ScoreProps) {
  if (value == null) return null;
  return (
    <span className={cn("score score--all", large && "score--lg")} title="Everyone's average">
      <Meter value={(value / 40) * 100} />
      <span className="sr-only">Average rating: </span>
      {(value / 4).toFixed(1)}
    </span>
  );
}

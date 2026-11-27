"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { formatRating, pluralize } from "@/lib/format";
import { profilePath } from "@/lib/profile";
import type { Target } from "@/lib/targets";
import { useTRPC } from "@/trpc/client";
import { MAX_RATING, ratingAfterKey, ratingAlong } from "./rating-dial-scale";

type Props = {
  target: Target;
  /** The viewer's own rating in quarter points. Null when they have not rated this. */
  initialValue: number | null;
  /** How many people gave each half point, 0 to 10: 21 counts. */
  bars: number[];
  /** What the people the viewer follows rated this, in quarter points. */
  following: { username: string; value: number }[];
  /** Everyone's average in quarter points, and how many ratings it is made of. */
  average: number | null;
  count: number;
  signedIn: boolean;
};

const SAVE_DELAY_MS = 400;
const SAVED_SHOWN_MS = 1800;

const HALF_POINTS = Array.from({ length: MAX_RATING / 2 + 1 }, (_, index) => index);
const QUARTER_POINTS = Array.from({ length: MAX_RATING + 1 }, (_, index) => index);
const WHOLE_POINTS = Array.from({ length: MAX_RATING / 4 + 1 }, (_, index) => index);

const percentAlong = (quarterPoints: number) => `${quarterPoints * (100 / MAX_RATING)}%`;
const outOfTen = (quarterPoints: number) => (quarterPoints / 4).toFixed(1);

function ratingUnder(event: React.PointerEvent<HTMLElement>): number {
  const box = event.currentTarget.getBoundingClientRect();
  return ratingAlong((event.clientX - box.left) / box.width);
}

/** Everyone's ratings as 21 bars, lit up to the viewer's own rating. */
function Histogram({ bars, value }: { bars: number[]; value: number | null }) {
  const peak = Math.max(...bars, 1);
  return (
    <div className="dial__hist" style={{ left: "-2.5%", right: "-2.5%" }}>
      {HALF_POINTS.map((halfPoint) => (
        <i
          key={halfPoint}
          className={value !== null && halfPoint * 2 <= value ? "on" : undefined}
          style={{ height: `${Math.max(3, ((bars[halfPoint] ?? 0) / peak) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Ruler() {
  return (
    <>
      <div className="dial__base" />
      <div className="dial__ticks">
        {QUARTER_POINTS.map((quarter) => (
          <i
            key={quarter}
            className={quarter % 4 === 0 ? "whole" : quarter % 2 === 0 ? "half" : undefined}
            style={{ left: percentAlong(quarter) }}
          />
        ))}
      </div>
      <div className="dial__nums">
        {WHOLE_POINTS.map((point) => (
          <span key={point} style={{ left: percentAlong(point * 4) }}>
            {point}
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * The rating instrument: drag, click, or use the arrow keys to rate out of 10 in quarter
 * points, on a ruler laid over how everyone else rated. A rating saves on its own once the
 * needle rests. A visitor sees the same picture, and the ruler takes them to sign in.
 */
export function RatingDialControl({
  target,
  initialValue,
  bars,
  following,
  average,
  count,
  signedIn,
}: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialValue);
  const [dragging, setDragging] = useState(false);
  const [confirmation, setConfirmation] = useState({ word: "Saved", shown: false });
  const [failed, setFailed] = useState(false);
  // Pointer moves arrive faster than renders, so the newest value is also kept outside state.
  const latest = useRef(initialValue);
  const stored = useRef(initialValue);
  const pendingSave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideConfirmation = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scale = useRef<HTMLDivElement>(null);
  const save = useMutation(trpc.ratings.save.mutationOptions());
  const remove = useMutation(trpc.ratings.remove.mutationOptions());

  async function store(next: number | null) {
    try {
      if (next === null) await remove.mutateAsync({ target });
      else await save.mutateAsync({ target, value: next });
    } catch {
      latest.current = stored.current;
      setValue(stored.current);
      setFailed(true);
      return;
    }
    stored.current = next;
    setConfirmation({ word: next === null ? "Cleared" : "Saved", shown: true });
    clearTimeout(hideConfirmation.current);
    hideConfirmation.current = setTimeout(
      () => setConfirmation((current) => ({ ...current, shown: false })),
      SAVED_SHOWN_MS,
    );
    router.refresh();
  }

  // Dragging passes through many values; only the one it rests on is saved.
  function change(next: number | null) {
    if (next === latest.current) return;
    latest.current = next;
    setValue(next);
    setFailed(false);
    setConfirmation((current) => ({ ...current, shown: false }));
    clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => store(next), next === null ? 0 : SAVE_DELAY_MS);
  }

  function startDragging(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setDragging(true);
    change(ratingUnder(event));
  }

  function stepWithKeys(event: React.KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const next = ratingAfterKey(event.key, latest.current);
    if (next === null) return;
    event.preventDefault();
    change(next);
  }

  function clear() {
    change(null);
    scale.current?.focus({ preventScroll: true });
  }

  const rated = value !== null;
  const signInPath = `/sign-in?next=${encodeURIComponent(pathname)}`;
  const followingAverage =
    following.reduce((sum, rating) => sum + rating.value, 0) / (following.length || 1);

  return (
    <section className={cn("dial", dragging && "dragging")} aria-label="Your rating">
      <div className="dial__read">
        <span className="label">Your rating</span>
        <div className={cn("dial__num", !rated && "is-empty")}>
          {rated ? formatRating(value) : "–"}
        </div>
        <div className="dial__sub">
          {signedIn ? (
            <>
              <span className="dial__state">{rated ? "out of 10" : "Not rated yet"}</span>
              <span className={cn("dial__saved", confirmation.shown && "on")} aria-hidden="true">
                <Icon name="check" size="sm" />
                {confirmation.word}
              </span>
              <span className="sr-only" role="status">
                {confirmation.shown && confirmation.word}
              </span>
              {rated && (
                <button type="button" aria-label="Clear rating" onClick={clear}>
                  Clear
                </button>
              )}
            </>
          ) : (
            <Link href={signInPath}>Sign in to rate</Link>
          )}
        </div>
      </div>

      {signedIn ? (
        <div
          ref={scale}
          className="dial__scale"
          role="slider"
          tabIndex={0}
          aria-label="Your rating out of 10"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={rated ? value / 4 : 0}
          aria-valuetext={rated ? `${formatRating(value)} out of 10` : "Not rated"}
          onPointerDown={startDragging}
          onPointerMove={(event) => {
            if (dragging) change(ratingUnder(event));
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={stepWithKeys}
        >
          {/*
            A slider's contents are hidden from assistive technology, so these marks are for
            the pointer only. The footer says the same in words.
          */}
          <div className="dial__friends">
            {following.map(({ username, value: theirs }) => (
              <Link
                key={username}
                href={profilePath(username)}
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: percentAlong(theirs) }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Avatar
                  username={username}
                  title={`@${username} rated it ${formatRating(theirs)}`}
                />
              </Link>
            ))}
          </div>
          <Histogram bars={bars} value={value} />
          <Ruler />
          <div
            className="dial__needle"
            hidden={!rated}
            style={{ left: percentAlong(value ?? MAX_RATING / 2) }}
          />
        </div>
      ) : (
        <Link
          className="dial__scale dial__scale--locked"
          href={signInPath}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Histogram bars={bars} value={null} />
          <Ruler />
        </Link>
      )}

      {failed && (
        <p role="alert" className="error dial__error">
          Your rating could not be saved. Check your connection and try again.
        </p>
      )}

      <div className="dial__foot">
        {average === null ? (
          <span>No ratings yet.</span>
        ) : (
          <span>
            Everyone <b>{outOfTen(average)}</b> from {pluralize(count, "rating")}
          </span>
        )}
        {following.length > 0 && (
          <span>
            People you follow <b>{outOfTen(followingAverage)}</b> from {following.length}
          </span>
        )}
        {signedIn && (
          <span className="dimmer" style={{ marginLeft: "auto" }}>
            Drag, click, or use the arrow keys
          </span>
        )}
      </div>
    </section>
  );
}

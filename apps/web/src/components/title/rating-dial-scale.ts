/** Ratings are whole quarter points: 0 is 0 and 40 is 10. */
export const MAX_RATING = 40;

const KEY_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 4,
  PageDown: -4,
};

const clamp = (rating: number) => Math.min(MAX_RATING, Math.max(0, rating));

/** The rating under a point on the scale, given how far along it the point is (0 to 1). */
export function ratingAlong(fraction: number): number {
  return clamp(Math.round(fraction * MAX_RATING));
}

/**
 * The rating a key press leads to: arrows move a quarter point, Page Up and Page Down a whole
 * point, Home and End go to the ends. Something not yet rated starts from the middle. Null for
 * a key the scale does not answer to.
 */
export function ratingAfterKey(key: string, current: number | null): number | null {
  if (key === "Home") return 0;
  if (key === "End") return MAX_RATING;
  const step = KEY_STEPS[key];
  return step === undefined ? null : clamp((current ?? MAX_RATING / 2) + step);
}

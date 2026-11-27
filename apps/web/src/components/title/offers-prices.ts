/**
 * The price a one-click alert offers: a fifth under today's best, written the way a shop
 * would, so $22.49 suggests $17.99. Null when that would not be below today's price.
 */
export function suggestedTarget(bestCents: number): number | null {
  const target = Math.round((bestCents * 0.8) / 100) * 100 - 1;
  return target >= 1 && target < bestCents ? target : null;
}

/**
 * Places prices along the price bar, which runs from a little under the lowest price marked
 * on it up to what the game usually costs. Returns how far along a price sits, as a
 * percentage kept clear of both ends so its label stays inside the bar. Null when the prices
 * leave nothing to draw a bar between.
 */
export function priceScale(
  markedCents: number[],
  regularCents: number,
): ((cents: number) => number) | null {
  if (markedCents.length === 0) return null;
  const floor = Math.min(...markedCents) * 0.9;
  const span = regularCents - floor;
  if (span <= 0) return null;
  return (cents) => Math.min(96, Math.max(4, ((cents - floor) / span) * 100));
}

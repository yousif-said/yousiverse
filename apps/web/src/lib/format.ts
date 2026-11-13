const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

/** Formats a calendar date (YYYY-MM-DD) without shifting it into the viewer's time zone. */
export function formatDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Formats a moment in time as the day it happened: "November 11, 2026". */
export function formatDay(moment: Date): string {
  return longDate.format(moment);
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Prices are stored in cents: 499 is shown as "$4.99". */
export function formatPrice(cents: number): string {
  return dollars.format(cents / 100);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Ratings are stored in quarter points: 33 is shown as "8.25", 32 as "8". */
export function formatRating(quarterPoints: number): string {
  return String(quarterPoints / 4);
}

/** An average of many ratings, to at most two decimal places: "7.83", "8.5". */
export function formatAverageRating(quarterPoints: number): string {
  return String(Number((quarterPoints / 4).toFixed(2)));
}

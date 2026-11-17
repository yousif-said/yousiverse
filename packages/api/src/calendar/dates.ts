const usDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

/** Today's date in the US (Eastern time), as YYYY-MM-DD. Release dates are US calendar days. */
export function usToday(now = new Date()): string {
  return usDate.format(now);
}

/** The date a number of days after (or, if negative, before) an ISO date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

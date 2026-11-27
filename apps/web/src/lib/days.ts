import { usToday } from "@yousiverse/api/dates";

export { usToday };

/** Calendar dates carry no time, so they are read as UTC to keep the day they name. */
const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const format = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(asDate(isoDate));

/** The US calendar day a moment fell on, as YYYY-MM-DD. */
export function dayOf(moment: Date): string {
  return usToday(moment);
}

/** Whole days from one calendar day to another. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000);
}

/** "Nov 26". */
export function shortDate(isoDate: string): string {
  return format(isoDate, { month: "short", day: "numeric" });
}

/** "Thursday". */
export function weekdayName(isoDate: string): string {
  return format(isoDate, { weekday: "long" });
}

/** How long ago a day was: "Today", "Yesterday", "Tuesday", "Nov 3", "Nov 3, 2025". */
export function agoLabel(isoDate: string, today = usToday()): string {
  const days = daysBetween(isoDate, today);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return weekdayName(isoDate);
  return isoDate.slice(0, 4) === today.slice(0, 4)
    ? shortDate(isoDate)
    : format(isoDate, { month: "short", day: "numeric", year: "numeric" });
}

/** How far off a day is: "Today", "Tomorrow", "Saturday", "In 12 days". */
export function untilLabel(isoDate: string, today = usToday()): string {
  const days = daysBetween(today, isoDate);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return weekdayName(isoDate);
  return `In ${days} days`;
}

/** Lowercases a relative day for use mid-sentence, leaving weekday and month names alone. */
export function midSentence(label: string): string {
  return label.replace(/^(Today|Tomorrow|Yesterday|In)\b/, (word) => word.toLowerCase());
}

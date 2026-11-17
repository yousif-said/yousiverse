import type { RouterOutputs } from "@yousiverse/api";
import type { MediaType } from "./media";

export type CalendarEntry = RouterOutputs["calendar"]["upcoming"]["entries"][number];
export type CalendarScope = "library" | "catalog";

const monthName = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const weekday = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** Calendar dates carry no time, so they are read as UTC to keep the day they name. */
const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

/** "Today", "Tomorrow", or the day in full: "Tuesday, November 24". */
export function dayLabel(isoDate: string, today: string): string {
  const daysAway = Math.round((asDate(isoDate).getTime() - asDate(today).getTime()) / 86_400_000);
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return weekday.format(asDate(isoDate));
}

/** What an entry is, beyond its title: which episodes air, or nothing for a release. */
export function entryDetail(entry: CalendarEntry): string | null {
  if (entry.kind === "release") return null;
  const season = entry.seasonNumber === 0 ? "Specials" : `Season ${entry.seasonNumber}`;
  if (entry.count === 1) {
    const episode = `${season}, episode ${entry.firstEpisode}`;
    return entry.episodeName ? `${episode}: ${entry.episodeName}` : episode;
  }
  return entry.lastEpisode === null
    ? `${entry.count} episodes`
    : `${season}, episodes ${entry.firstEpisode} to ${entry.lastEpisode}`;
}

type Day = { date: string; entries: CalendarEntry[] };

/** Splits entries, already in date order, into months and then days. */
export function byMonth(entries: CalendarEntry[]): { month: string; days: Day[] }[] {
  const months: { month: string; days: Day[] }[] = [];
  for (const entry of entries) {
    const month = monthName.format(asDate(entry.date));
    let current = months.at(-1);
    if (current?.month !== month) {
      current = { month, days: [] };
      months.push(current);
    }
    const day = current.days.at(-1);
    if (day?.date === entry.date) day.entries.push(entry);
    else current.days.push({ date: entry.date, entries: [entry] });
  }
  return months;
}

export function isCalendarScope(value: unknown): value is CalendarScope {
  return value === "library" || value === "catalog";
}

export function calendarPath(scope?: CalendarScope, type?: MediaType): string {
  const params = new URLSearchParams();
  if (scope) params.set("show", scope);
  if (type) params.set("type", type);
  return params.size > 0 ? `/calendar?${params}` : "/calendar";
}

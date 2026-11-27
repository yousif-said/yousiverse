import type { RouterOutputs } from "@yousiverse/api";
import { addDays } from "@yousiverse/api/dates";
import { shortDate } from "./days";
import type { MediaType } from "./media";

export type CalendarEntry = RouterOutputs["calendar"]["upcoming"]["entries"][number];
export type CalendarScope = "library" | "catalog";
export type CalendarDay = { date: string; entries: CalendarEntry[] };
/** A stretch of the calendar under one heading: "This week", "Next week", or a month. */
export type CalendarWeek = { name: string; days: CalendarDay[] };
export type MonthGrid = {
  name: string;
  year: number;
  /** Empty cells before the 1st, so that it falls under its weekday in a week that starts on Sunday. */
  leading: number;
  days: string[];
};

/** Calendar dates carry no time, so they are read as UTC to keep the day they name. */
const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const format = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(asDate(isoDate));

/** "Fri". */
export const shortWeekday = (isoDate: string) => format(isoDate, { weekday: "short" });
/** "December 4". */
export const monthAndDay = (isoDate: string) => format(isoDate, { month: "long", day: "numeric" });
const monthName = (isoDate: string) => format(isoDate, { month: "long" });

/** The day of the month, without a leading zero. */
export const dayOfMonth = (isoDate: string) => Number(isoDate.slice(8));

// What a provider calls an episode it has no name for.
const UNNAMED_EPISODE = /^Episode \d+$/;

/** What an entry is, beyond its title: which episodes air, or where a release comes out. */
export function entryDetail(entry: CalendarEntry): string {
  if (entry.kind === "release") {
    if (entry.title.type === "movie") return "In theaters";
    return entry.platforms.length > 0 ? entry.platforms.slice(0, 3).join(", ") : "Release day";
  }
  const season = entry.seasonNumber === 0 ? "Specials" : `Season ${entry.seasonNumber}`;
  if (entry.count === 1) {
    const episode = `${season}, episode ${entry.firstEpisode}`;
    const named = entry.episodeName && !UNNAMED_EPISODE.test(entry.episodeName);
    return named ? `${episode} · ${entry.episodeName}` : episode;
  }
  return entry.lastEpisode === null
    ? `${entry.count} episodes`
    : `${season}, episodes ${entry.firstEpisode} to ${entry.lastEpisode}`;
}

/**
 * Splits entries, already in date order, into this week, next week, and then one group for each
 * month after that, each holding its days. A week ends on Sunday.
 */
export function byWeek(entries: CalendarEntry[], today: string): CalendarWeek[] {
  const endOfWeek = addDays(today, (7 - asDate(today).getUTCDay()) % 7);
  const endOfNext = addDays(endOfWeek, 7);
  const nameOf = (date: string) => {
    if (date <= endOfWeek) return "This week";
    return date <= endOfNext ? "Next week" : monthName(date);
  };

  const weeks: CalendarWeek[] = [];
  for (const entry of entries) {
    const name = nameOf(entry.date);
    let week = weeks.at(-1);
    if (week?.name !== name) {
      week = { name, days: [] };
      weeks.push(week);
    }
    const day = week.days.at(-1);
    if (day?.date === entry.date) day.entries.push(entry);
    else week.days.push({ date: entry.date, entries: [entry] });
  }
  return weeks;
}

/** The days a group covers: "Nov 26", or "Nov 26 to Nov 29". */
export function spanLabel(days: CalendarDay[]): string {
  const [first, last] = [days.at(0), days.at(-1)];
  if (!first || !last) return "";
  return first === last
    ? shortDate(first.date)
    : `${shortDate(first.date)} to ${shortDate(last.date)}`;
}

/** Every month from the one `from` falls in to the one `until` falls in, as a grid of days. */
export function monthGrids(from: string, until: string): MonthGrid[] {
  const grids: MonthGrid[] = [];
  let first = `${from.slice(0, 7)}-01`;
  while (first <= until) {
    const start = asDate(first);
    const year = start.getUTCFullYear();
    const length = new Date(Date.UTC(year, start.getUTCMonth() + 1, 0)).getUTCDate();
    const firstOfMonth = first;
    grids.push({
      name: monthName(first),
      year,
      leading: start.getUTCDay(),
      days: Array.from({ length }, (_, index) => addDays(firstOfMonth, index)),
    });
    first = addDays(first, length);
  }
  return grids;
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

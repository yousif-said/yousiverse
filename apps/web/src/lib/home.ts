import type { RouterOutputs } from "@yousiverse/api";

export type HomeSummary = RouterOutputs["home"]["summary"];
export type ComingUpEntry = HomeSummary["comingUp"][number];
export type ActivityItem = HomeSummary["activity"][number];

/** Calendar dates carry no time, so they are read as UTC to keep the day they name. */
const format = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );

/** "Thursday, November 26": the day written out at the top of Home. */
export function longDay(isoDate: string): string {
  return format(isoDate, { weekday: "long", month: "long", day: "numeric" });
}

/** "Sat, Nov 28": the day under a countdown. */
export function weekdayDate(isoDate: string): string {
  return format(isoDate, { weekday: "short", month: "short", day: "numeric" });
}

const usHour = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "America/New_York",
});

/**
 * "Good morning, Sam." The time of day is the US one (Eastern time), like every date in the app.
 * A person with no name on their account is greeted without one.
 */
export function greeting(name: string, now = new Date()): string {
  const hour = Number(usHour.format(now));
  const timeOfDay =
    hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : "evening";
  const [firstName] = name.trim().split(/\s+/);
  return firstName ? `Good ${timeOfDay}, ${firstName}.` : `Good ${timeOfDay}.`;
}

/** What an upcoming entry is waiting on, ready to follow its title: "is back", "opens". */
export function arrivalVerb(entry: ComingUpEntry): string {
  if (entry.kind === "episode") return "is back";
  return entry.title.type === "movie" ? "opens" : "is out";
}

/** Which episode: "Season 2, episode 7". Specials are season 0. */
export function episodeLabel(seasonNumber: number, episodeNumber: number): string {
  const season = seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`;
  return `${season}, episode ${episodeNumber}`;
}

/**
 * Splits the wall's titles into its columns. Titles arrive dealt out by type, so shifting each
 * round by one column keeps every column from being all posters or all screens.
 */
export function wallColumns<Title>(titles: Title[], columns: number): Title[][] {
  const result: Title[][] = Array.from({ length: columns }, () => []);
  titles.forEach((title, index) => {
    const round = Math.floor(index / columns);
    result[(index + round) % columns]?.push(title);
  });
  return result;
}

import { cn } from "cn";
import {
  type CalendarEntry,
  dayOfMonth,
  type MonthGrid as Month,
  monthAndDay,
} from "@/lib/calendar";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Props = {
  month: Month;
  /** What comes out on each day that has something, by date. */
  byDay: Map<string, CalendarEntry[]>;
  today: string;
  /** The last day the calendar covers. */
  until: string;
};

/**
 * One small month: a dot per medium on each day that has something, and today outlined. A day
 * with something is a link down to that day in the list; the rest is there only to be looked at.
 */
export function MonthGrid({ month, byDay, today, until }: Props) {
  return (
    <div className="month">
      <div className="month__name">
        <span>{month.name}</span>
        <span className="hint mono">{month.year}</span>
      </div>
      <div className="month__grid">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} aria-hidden="true">
            {weekday.charAt(0)}
          </span>
        ))}
        {Array.from({ length: month.leading }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical empty cells
          <span key={index} className="month__d out" aria-hidden="true" />
        ))}
        {month.days.map((date) => {
          const entries = byDay.get(date) ?? [];
          const classes = cn(
            "month__d",
            date >= today && date <= until && "in",
            entries.length > 0 && "has",
            date === today && "today",
          );
          if (entries.length === 0) {
            return (
              <span key={date} className={classes} aria-hidden="true">
                {dayOfMonth(date)}
              </span>
            );
          }
          const titles = entries.map((entry) => entry.title.title).join(", ");
          const kinds = [...new Set(entries.map((entry) => entry.title.type))];
          return (
            <a
              key={date}
              href={`#day-${date}`}
              className={classes}
              title={titles}
              aria-label={`${monthAndDay(date)}: ${titles}`}
            >
              {dayOfMonth(date)}
              <span className="month__dots">
                {kinds.map((kind) => (
                  <i key={kind} style={{ background: `var(--${kind})` }} />
                ))}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

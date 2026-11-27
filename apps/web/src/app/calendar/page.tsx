import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDay } from "@/components/find/calendar-day";
import { MonthGrid } from "@/components/find/month-grid";
import { LinkSegmented, LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { byWeek, calendarPath, isCalendarScope, monthGrids, spanLabel } from "@/lib/calendar";
import { getMarks } from "@/lib/marks";
import { isMediaType, MEDIA } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Movies, games, and episodes coming out in the next 90 days.",
};

// Books have no release dates at their source, so the calendar never lists any.
const CALENDAR_TYPES = ["movie", "tv", "game"] as const;

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const type = isMediaType(params.type) && params.type !== "book" ? params.type : undefined;
  // A signed-out visitor has no library, so they see the whole catalog.
  const wanted = isCalendarScope(params.show) ? params.show : undefined;
  const scope = session ? (wanted ?? "library") : "catalog";

  const { today, until, entries, counts } = await getQueryClient().fetchQuery(
    trpc.calendar.upcoming.queryOptions({ scope, type }),
  );
  const marks = await getMarks(entries.map((entry) => entry.title.mediaId));
  const weeks = byWeek(entries, today);
  const byDay = new Map(weeks.flatMap(({ days }) => days.map((day) => [day.date, day.entries])));

  return (
    <div className="page">
      <PageHeader
        title="Calendar"
        lede={`${
          scope === "library"
            ? "The next 90 days from your library, with new episodes of your shows."
            : "Everything in the catalog coming out in the next 90 days."
        } US dates, and they can move.`}
        actions={
          session && (
            <LinkSegmented
              label="Which titles"
              choices={[
                {
                  href: calendarPath(undefined, type),
                  label: "Your library",
                  current: scope === "library",
                },
                {
                  href: calendarPath("catalog", type),
                  label: "Everything",
                  current: scope === "catalog",
                },
              ]}
            />
          )
        }
      />
      <LinkTabs
        label="Filter by type"
        choices={[
          {
            href: calendarPath(wanted),
            label: "All",
            current: !type,
            count: counts.movie + counts.tv + counts.game,
          },
          ...CALENDAR_TYPES.map((option) => ({
            href: calendarPath(wanted, option),
            label: MEDIA[option].label,
            current: option === type,
            count: counts[option],
            icon: MEDIA[option].icon,
            iconClassName: `c-${option}`,
          })),
        ]}
      />

      <div className="cal" style={{ marginTop: 34 }}>
        <div>
          {entries.length === 0 && (
            <div className="empty">
              Nothing {scope === "library" ? "in your library" : "in the catalog"} has a date in the
              next 90 days.
              {scope === "library" && (
                <>
                  {" "}
                  <Link className="link" href={calendarPath("catalog", type)}>
                    See everything
                  </Link>
                </>
              )}
            </div>
          )}
          {weeks.map(({ name, days }) => (
            <section key={name} className="cal__week" aria-labelledby={`week-${days[0]?.date}`}>
              <div className="cal__weekhead">
                <h2 className="d3" id={`week-${days[0]?.date}`}>
                  {name}
                </h2>
                <span className="hint mono">{spanLabel(days)}</span>
              </div>
              {days.map((day) => (
                <CalendarDay
                  key={day.date}
                  day={day}
                  today={today}
                  statuses={marks.status}
                  canAdd={Boolean(session)}
                />
              ))}
            </section>
          ))}
          <p className="hint" style={{ marginTop: 22 }}>
            Books are not on the calendar: their source gives no release dates.
          </p>
        </div>
        <aside className="cal__aside" aria-label="Months">
          {monthGrids(today, until).map((month) => (
            <MonthGrid
              key={`${month.year}-${month.name}`}
              month={month}
              byDay={byDay}
              today={today}
              until={until}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}

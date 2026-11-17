import type { Metadata } from "next";
import Link from "next/link";
import { FilterPill } from "@/components/filter-pill";
import { byMonth, calendarPath, dayLabel, entryDetail, isCalendarScope } from "@/lib/calendar";
import { isMediaType, MEDIA, MEDIA_TYPES, mediaPath } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Release calendar",
  description: "Movies, games, and episodes coming out in the next 90 days.",
};

// Books have no release dates at their source, so the calendar never lists any.
const CALENDAR_TYPES = MEDIA_TYPES.filter((type) => type !== "book");

const textLink =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [params, session] = await Promise.all([searchParams, getSession()]);
  const type = isMediaType(params.type) && params.type !== "book" ? params.type : undefined;
  // A signed-out visitor has no library, so they see the whole catalog.
  const wanted = isCalendarScope(params.show) ? params.show : undefined;
  const scope = session ? (wanted ?? "library") : "catalog";

  const { today, entries } = await getQueryClient().fetchQuery(
    trpc.calendar.upcoming.queryOptions({ scope, type }),
  );

  return (
    <section className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Release calendar</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        {scope === "library"
          ? "What is coming out in the next 90 days from the titles in your library, with new episodes of your shows."
          : "What is coming out in the next 90 days, from every title in the catalog."}{" "}
        Dates are for the US and can move.
      </p>

      {session && (
        <nav aria-label="Which titles" className="mt-6 flex flex-wrap gap-2">
          <FilterPill href={calendarPath(undefined, type)} selected={scope === "library"}>
            Your library
          </FilterPill>
          <FilterPill href={calendarPath("catalog", type)} selected={scope === "catalog"}>
            Whole catalog
          </FilterPill>
        </nav>
      )}
      <nav aria-label="Filter by type" className="mt-3 flex flex-wrap gap-2">
        <FilterPill href={calendarPath(wanted)} selected={!type}>
          All
        </FilterPill>
        {CALENDAR_TYPES.map((option) => (
          <FilterPill
            key={option}
            href={calendarPath(wanted, option)}
            selected={option === type}
            color={MEDIA[option].color}
          >
            {MEDIA[option].label}
          </FilterPill>
        ))}
      </nav>

      {entries.length === 0 && (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          {scope === "library" ? (
            <>
              Nothing in your library has a date in the next 90 days.{" "}
              <Link href={calendarPath("catalog", type)} className={textLink}>
                See the whole catalog
              </Link>
              , or add an upcoming title to your library.
            </>
          ) : (
            "Nothing in the catalog has a date in the next 90 days."
          )}
        </p>
      )}

      {byMonth(entries).map(({ month, days }) => (
        <section key={month} aria-labelledby={`month-${month}`} className="mt-12">
          <h2 id={`month-${month}`} className="font-display text-2xl font-bold tracking-tight">
            {month}
          </h2>
          <dl className="mt-4 divide-y border-y">
            {days.map((day) => (
              <div key={day.date} className="grid gap-x-8 gap-y-2 py-4 sm:grid-cols-[13rem_1fr]">
                <dt className="text-sm font-medium">
                  <time dateTime={day.date}>{dayLabel(day.date, today)}</time>
                </dt>
                <dd>
                  <ul className="space-y-3">
                    {day.entries.map((entry) => {
                      const detail = entryDetail(entry);
                      return (
                        <li key={`${entry.title.type}-${entry.title.providerId}`}>
                          <Link
                            href={mediaPath(entry.title.type, entry.title.providerId)}
                            className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            {entry.title.title}
                          </Link>
                          <span className="block text-sm text-muted-foreground">
                            {MEDIA[entry.title.type].singular}
                            {detail && `, ${detail}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}

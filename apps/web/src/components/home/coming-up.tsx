import { Medium } from "@/components/media/medium";
import { Shelf, TitleCard } from "@/components/media/title-card";
import { SectionHead } from "@/components/ui/section-head";
import { daysBetween } from "@/lib/days";
import { type ComingUpEntry, episodeLabel, weekdayDate } from "@/lib/home";

/** How long until a day: a big number of days, or "Today", over the date itself. */
function Countdown({ date, today }: { date: string; today: string }) {
  const days = daysBetween(today, date);
  return (
    <div>
      <span className="d3">{days === 0 ? "Today" : days}</span>
      {days !== 0 && (
        <>
          {" "}
          <span className="label">{days === 1 ? "day" : "days"}</span>
        </>
      )}
      <div className="hint mt-0.5">{weekdayDate(date)}</div>
    </div>
  );
}

function EntryCard({ entry }: { entry: ComingUpEntry }) {
  const meta =
    entry.kind === "episode" ? (
      <span>{episodeLabel(entry.seasonNumber, entry.episodeNumber)}</span>
    ) : (
      <>
        <Medium type={entry.title.type} label={false} />
        <span>{entry.title.type === "movie" ? "In theaters" : "Release day"}</span>
      </>
    );
  return <TitleCard title={entry.title} meta={meta} />;
}

/** The next dated thing for each title in the library, soonest first, counted down in days. */
export function ComingUp({ entries, today }: { entries: ComingUpEntry[]; today: string }) {
  return (
    <section className="section" aria-labelledby="soon-h">
      <SectionHead
        id="soon-h"
        title="Coming up for you"
        sub="From your library, in the next 90 days"
        more={{ href: "/calendar", label: "Calendar" }}
      />
      <Shelf>
        {entries.map((entry) => (
          <div key={entry.title.mediaId} className="flex flex-none flex-col gap-3">
            <Countdown date={entry.date} today={today} />
            <EntryCard entry={entry} />
          </div>
        ))}
      </Shelf>
    </section>
  );
}

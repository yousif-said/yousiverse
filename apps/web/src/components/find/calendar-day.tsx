import { cn } from "cn";
import { Medium } from "@/components/media/medium";
import { TitleRow } from "@/components/media/title-row";
import { WantButton } from "@/components/media/want-button";
import { Icon } from "@/components/ui/icon";
import { type CalendarDay as Day, dayOfMonth, entryDetail, shortWeekday } from "@/lib/calendar";
import { untilLabel } from "@/lib/days";
import { type LibraryStatus, STATUS_ICONS, statusLabel } from "@/lib/library";

type Props = {
  day: Day;
  today: string;
  /** The signed-in person's status for each title, by media id. */
  statuses: Map<string, LibraryStatus>;
  /** Offer to add what is not in the library yet. Off for a visitor, who has none. */
  canAdd: boolean;
};

/** One day of the calendar: its date, and a row for everything that comes out on it. */
export function CalendarDay({ day, today, statuses, canAdd }: Props) {
  const isToday = day.date === today;
  return (
    <div className={cn("day", isToday && "today")} id={`day-${day.date}`}>
      <div className="day__date">
        <span>{isToday ? "Today" : shortWeekday(day.date)}</span>
        <b>{dayOfMonth(day.date)}</b>
      </div>
      <div className="day__list">
        {day.entries.map((entry) => {
          const { title } = entry;
          const status = statuses.get(title.mediaId);
          return (
            <TitleRow
              key={title.mediaId}
              title={title}
              className="rel"
              sub={
                <>
                  <Medium type={title.type} />
                  <span>{entryDetail(entry)}</span>
                </>
              }
              end={
                <>
                  <span className="chip chip--line">{untilLabel(day.date, today)}</span>
                  {status ? (
                    <span className="chip" title="In your library">
                      <Icon name={STATUS_ICONS[status]} size="sm" />
                      {statusLabel(status, title.type)}
                    </span>
                  ) : (
                    canAdd && (
                      <WantButton mediaId={title.mediaId} type={title.type} title={title.title} />
                    )
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

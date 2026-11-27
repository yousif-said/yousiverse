import { Icon } from "@/components/ui/icon";
import { untilLabel } from "@/lib/days";
import { formatDate } from "@/lib/format";

/** What every link out to a streaming service or a store carries. */
export const OUTBOUND = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Tells screen readers that a link leaves the site. Put it last inside the link. */
export function NewTab() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

/** The panel's place on the page while its offers are being fetched. */
export function OffersLoading({ children }: { children: string }) {
  return (
    <div className="offers offers--loading skel" aria-busy="true">
      <span className="sr-only">{children}</span>
    </div>
  );
}

/** Said in place of the panel when there is nothing to list. */
export function OffersNote({ children }: { children: string }) {
  return (
    <div className="note">
      <Icon name="info" />
      <span>{children}</span>
    </div>
  );
}

type ComingOutProps = {
  /** What the date is: "In theaters", "Premieres", "Out". */
  label: string;
  date: string;
  /** What will show here once it is out: "Streaming details appear once it is out." */
  note: string;
  action?: React.ReactNode;
};

/** The panel for a title that is not out yet: its date, and how far off that is. */
export function ComingOut({ label, date, note, action }: ComingOutProps) {
  return (
    <div className="offers">
      <div className="offers__now">
        <div>
          <span className="label">{label}</span>
          <div className="d3" style={{ marginTop: 6 }}>
            {formatDate(date)}
          </div>
          <p>
            {untilLabel(date)}. {note}
          </p>
        </div>
        {action}
      </div>
    </div>
  );
}

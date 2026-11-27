import { Medium } from "@/components/media/medium";
import { Score } from "@/components/media/score";
import { TitleCard, Wall } from "@/components/media/title-card";
import { Icon } from "@/components/ui/icon";
import { type LibraryStatus, SHELF_ORDER, STATUS_LABELS } from "@/lib/library";
import { LIMITED_TO, type LibraryListEntry, progressLine } from "@/lib/library-view";

type Props = {
  /** The entries to show, already filtered and in order. */
  entries: LibraryListEntry[];
  /** Set when only one status is shown, so there is nothing to group by. */
  status?: LibraryStatus;
  today: string;
};

/**
 * A card's second line: the medium, the person's own rating, then how far through they are (or
 * the year), and a mark when not everyone can see the entry.
 */
function EntryMeta({ entry, today }: { entry: LibraryListEntry; today: string }) {
  const detail = entry.progress ? progressLine(entry.progress, today).text : entry.releaseYear;
  const limitedTo = entry.visibility === "public" ? null : LIMITED_TO[entry.visibility];
  return (
    <>
      <Medium type={entry.type} label={false} />
      <Score value={entry.rating} />
      {detail !== null && <span>{detail}</span>}
      {limitedTo && (
        <span title={limitedTo.label}>
          <Icon name={limitedTo.icon} size="sm" />
          <span className="sr-only">{limitedTo.label}</span>
        </span>
      )}
    </>
  );
}

function EntryWall({ entries, today }: { entries: LibraryListEntry[]; today: string }) {
  return (
    <Wall>
      {entries.map((entry) => (
        <TitleCard
          key={entry.mediaId}
          title={entry}
          meta={<EntryMeta entry={entry} today={today} />}
        />
      ))}
    </Wall>
  );
}

/**
 * The library as shelves: one wall per status, what is under way first. Filtered to a single
 * status it is one wall with no heading, because the filter already says which.
 */
export function LibraryShelves({ entries, status, today }: Props) {
  if (status) return <EntryWall entries={entries} today={today} />;

  return SHELF_ORDER.map((group) => {
    const onShelf = entries.filter((entry) => entry.status === group);
    if (onShelf.length === 0) return null;
    return (
      <section key={group} className="lgroup" aria-labelledby={`shelf-${group}`}>
        <div className="lgroup__head">
          <h2 className="d3" id={`shelf-${group}`}>
            {STATUS_LABELS[group]}
          </h2>
          <span className="mono">{onShelf.length}</span>
        </div>
        <EntryWall entries={onShelf} today={today} />
      </section>
    );
  });
}

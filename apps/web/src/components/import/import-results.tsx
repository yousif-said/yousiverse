import type { RouterOutputs } from "@yousiverse/api";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import { unmatchedCount } from "@/lib/imports";
import { searchPath } from "@/lib/media";

type Props = { job: RouterOutputs["imports"]["get"] };

/** What a finished import left for its owner: what it could not place, and where to go next. */
export function ImportResults({ job }: Props) {
  const unmatched = unmatchedCount(job.progress);
  const unlisted = unmatched - job.unmatched.length;

  return (
    <>
      {job.skippedCount > 0 && (
        <div className="note mt-5">
          <Icon name="info" />
          <span>
            {pluralize(job.skippedCount, "entry", "entries")} in the export{" "}
            {job.skippedCount === 1 ? "was" : "were"} left out, because there is no place here for
            things like single episodes.
          </span>
        </div>
      )}
      {unmatched > 0 && (
        <section aria-labelledby="unmatched-h" style={{ marginTop: 30 }}>
          <div className="sh">
            <div>
              <h2 className="d3" id="unmatched-h">
                Could not be matched
              </h2>
              <p className="sh__sub">
                A match has to be confident, so anything doubtful is left for you.
              </p>
            </div>
          </div>
          <ul>
            {job.unmatched.map((item) => (
              <li key={item.id} className="kv">
                <span className="min-w-0 wrap-anywhere">
                  {item.title}
                  {item.year ? ` (${item.year})` : null}
                  {item.creator && <span className="dim"> · {item.creator}</span>}
                </span>
                <Link
                  className="btn btn--sm btn--soft"
                  href={searchPath(item.title)}
                  aria-label={`Search for ${item.title}`}
                >
                  <Icon name="search" size="sm" />
                  Search
                </Link>
              </li>
            ))}
          </ul>
          {unlisted > 0 && (
            <p className="hint mt-4">
              And {pluralize(unlisted, "more title")} that could not be matched.
            </p>
          )}
        </section>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
        <Link className="btn btn--primary" href="/library">
          Open your library
        </Link>
        <Link className="btn btn--soft" href="/import">
          Import something else
        </Link>
      </div>
    </>
  );
}

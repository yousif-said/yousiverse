import { Fragment } from "react";
import type { MediaType } from "@/lib/media";

export type Fact = { label: string; value: string | number | null | undefined };

/** Where each medium's catalog details come from. */
const SOURCES: Record<MediaType, string> = {
  movie: "TMDB",
  tv: "TMDB",
  game: "IGDB",
  book: "Open Library",
};

type Props = { type: MediaType; facts: Fact[] };

/** The reference details of a title: dates, people, length. Facts with no value are left out. */
export function Facts({ type, facts }: Props) {
  const known = facts.filter((fact) => fact.value);
  return (
    <div className="panel">
      <div className="panel__head">
        <h3 className="label">Details</h3>
      </div>
      <dl className="facts">
        {known.map(({ label, value }) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="hint" style={{ marginTop: 14 }}>
        From {SOURCES[type]}
      </p>
    </div>
  );
}

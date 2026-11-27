import Link from "next/link";
import type { CSSProperties } from "react";
import { Thumb } from "@/components/media/artwork";
import { Average } from "@/components/media/score";
import { Shelf, TitleCard, YearMeta } from "@/components/media/title-card";
import { Icon } from "@/components/ui/icon";
import { formatRating } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { ratioOf } from "@/lib/titles";
import { getQueryClient, trpc } from "@/trpc/server";

/**
 * A row of suggestions for each title the person rated highly. The first time, similar titles
 * are fetched from a provider, so this is rendered inside a `Suspense` boundary.
 */
export async function BecauseRows() {
  const { rows, hasLikedTitles, incomplete } = await getQueryClient().fetchQuery(
    trpc.recommendations.forYou.queryOptions(),
  );

  return (
    <>
      {incomplete && (
        <p role="status" className="note section">
          <Icon name="info" size="sm" />
          <span>Some suggestions could not be loaded right now. Try again in a little while.</span>
        </p>
      )}

      {rows.length === 0 && !incomplete && (
        <div className="empty section">
          {hasLikedTitles ? (
            "Nothing new to suggest yet. Rate a few more titles and check back."
          ) : (
            <>
              Rate a title 7 or higher and suggestions will appear here.{" "}
              <Link className="link" href="/search">
                Search for something you love
              </Link>{" "}
              to start.
            </>
          )}
        </div>
      )}

      {rows.map(({ seed, titles }) => {
        const headingId = `because-${seed.type}-${seed.providerId}`;
        const labelId = `${headingId}-label`;
        return (
          <section key={headingId} className="section" aria-labelledby={`${labelId} ${headingId}`}>
            <div className="sh">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Thumb title={seed} decorative />
                <div>
                  <span className="label" id={labelId}>
                    {seed.author ? `More by ${seed.author}` : "Because you rated"}
                  </span>
                  <h2 className="d3" id={headingId} style={{ marginTop: 4 }}>
                    <Link href={mediaPath(seed.type, seed.providerId)}>{seed.title}</Link>{" "}
                    <span className="dimmer">{formatRating(seed.rating)}</span>
                  </h2>
                </div>
              </div>
            </div>
            <Shelf>
              {titles.map((title) => (
                <TitleCard
                  key={`${title.type}:${title.providerId}`}
                  title={title}
                  meta={
                    <>
                      <YearMeta title={title} />
                      <Average value={title.average} />
                    </>
                  }
                />
              ))}
            </Shelf>
          </section>
        );
      })}
    </>
  );
}

/** Stands in for the rows while the first of them loads: a heading's worth of space and a shelf. */
export function BecauseRowsPlaceholder() {
  return (
    <section className="section" role="status" aria-label="Finding suggestions">
      <div className="sh">
        <div className="skel" style={{ width: 280, height: 54 }} />
      </div>
      <div className="shelf">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: identical static placeholders
            key={index}
            className="card"
            style={{ "--ratio": ratioOf({ type: "movie" }) } as CSSProperties}
          >
            <div className="art art--movie skel" />
          </div>
        ))}
      </div>
    </section>
  );
}

import { imageAt } from "@yousiverse/integrations/images";
import { cn } from "cn";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Icon } from "@/components/ui/icon";
import { formatRuntime } from "@/lib/format";
import { episodeLabel, type HomeSummary } from "@/lib/home";
import { statusLabel } from "@/lib/library";
import { libraryViewPath, progressLine } from "@/lib/library-view";
import { mediaPath } from "@/lib/media";
import { ambientOf, tonedClass, toneStyle } from "@/lib/titles";
import { LeadActions } from "./lead-actions";

type InProgress = HomeSummary["inProgress"];
type Lead = NonNullable<InProgress["lead"]>;
type Entry = InProgress["others"][number];

const dimmed = { fontSize: 15.5, color: "var(--fg-2)" };

/** The title Home leads with: its artwork, how far through it the person is, and what is next. */
function LeadTitle({ lead, today }: { lead: Lead; today: string }) {
  const titleHref = mediaPath(lead.type, lead.providerId);
  const image = ambientOf(lead);
  const line = lead.progress && progressLine(lead.progress, today);
  const next = lead.progress?.kind === "episodes" ? lead.progress.next : null;
  // Only an episode that is out can be watched; one still to air is named with its date instead.
  const episodeOut =
    next?.airDate && next.airDate <= today && lead.nextEpisode
      ? { ...next, ...lead.nextEpisode }
      : null;

  return (
    <div
      className={cn("resume__main night", tonedClass(lead), !image && "resume__main--blank")}
      style={toneStyle(lead)}
    >
      {image && (
        // biome-ignore lint/performance/noImgElement: provider CDNs already serve sized images, so Next's optimizer would only add cost.
        <img src={imageAt(image, "large")} alt="" />
      )}
      <div className="resume__body">
        <span className="label" style={{ color: "var(--fg-2)" }}>
          Pick up where you left off
        </span>
        <h2 className="d2">
          <Link href={titleHref}>{lead.title}</Link>
        </h2>
        {episodeOut ? (
          <p style={dimmed}>
            {episodeLabel(episodeOut.seasonNumber, episodeOut.episodeNumber)} ·{" "}
            <span style={{ color: "var(--fg)" }}>{episodeOut.name}</span>
            {episodeOut.runtimeMinutes ? ` · ${formatRuntime(episodeOut.runtimeMinutes)}` : ""}
          </p>
        ) : (
          line && <p style={dimmed}>{line.text}</p>
        )}
        {line && line.percent !== null && (
          <div className="bar" style={{ "--v": line.percent, maxWidth: 340 } as CSSProperties}>
            <i />
          </div>
        )}
        {episodeOut ? (
          <LeadActions
            episodeId={episodeOut.id}
            episodeNumber={episodeOut.episodeNumber}
            episodeHref={`${titleHref}/seasons/${episodeOut.seasonNumber}/episodes/${episodeOut.episodeNumber}`}
          />
        ) : (
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Link className="btn btn--primary" href={titleHref}>
              Open
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Another title under way, beside the lead: where the person is in it, as a link to it. */
function InProgressCard({ entry, today }: { entry: Entry; today: string }) {
  const line = entry.progress && progressLine(entry.progress, today);
  return (
    <Link
      className={cn("prog", tonedClass(entry))}
      href={mediaPath(entry.type, entry.providerId)}
      style={toneStyle(entry)}
    >
      <Thumb title={entry} link={false} />
      <div className="min-w-0">
        <div className="prog__t">{entry.title}</div>
        <div className="prog__s">
          <Medium type={entry.type} label={false} />{" "}
          {line?.text ?? statusLabel("in_progress", entry.type)}
        </div>
        {line?.percent ? (
          <div className="bar" style={{ "--v": line.percent } as CSSProperties}>
            <i />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

/** Home's lead: the title to pick back up, and up to three more that are under way. */
export function Resume({ inProgress, today }: { inProgress: InProgress; today: string }) {
  const { lead, others, total } = inProgress;
  if (!lead) return null;

  return (
    <section
      className={cn("resume", others.length === 0 && "resume--alone")}
      aria-label="Pick up where you left off"
    >
      <LeadTitle lead={lead} today={today} />
      {others.length > 0 && (
        <div className="resume__side">
          {others.map((entry) => (
            <InProgressCard key={entry.mediaId} entry={entry} today={today} />
          ))}
          <Link
            className="sh__more"
            href={libraryViewPath({ status: "in_progress" })}
            style={{ padding: "4px 6px" }}
          >
            All {total} in progress
            <Icon name="arrow-r" size="sm" />
          </Link>
        </div>
      )}
    </section>
  );
}

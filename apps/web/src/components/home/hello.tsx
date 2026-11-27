import Link from "next/link";
import { Fragment } from "react";
import { midSentence, untilLabel } from "@/lib/days";
import { pluralize } from "@/lib/format";
import { arrivalVerb, greeting, type HomeSummary, longDay } from "@/lib/home";
import { libraryViewPath } from "@/lib/library-view";
import { mediaPath } from "@/lib/media";
import type { TitleArt } from "@/lib/titles";

function TitleLink({ title }: { title: TitleArt }) {
  return (
    <Link className="link" href={mediaPath(title.type, title.providerId)}>
      {title.title}
    </Link>
  );
}

/**
 * Home in one sentence: the episode that is next (or how much is under way), the first thing
 * coming up, and the next movie to open.
 */
function Lede({ summary }: { summary: HomeSummary }) {
  const { today, inProgress, comingUp } = summary;
  const { lead } = inProgress;
  const next = lead?.progress?.kind === "episodes" ? lead.progress.next : null;
  const [firstSoon] = comingUp;
  const nextMovie = comingUp.find(
    (entry) => entry !== firstSoon && entry.kind === "release" && entry.title.type === "movie",
  );

  const clauses: { key: string; text: React.ReactNode }[] = [];
  if (lead && next?.airDate && next.airDate <= today) {
    clauses.push({
      key: "next",
      text: (
        <>
          Episode {next.episodeNumber} of <TitleLink title={lead} /> is next
        </>
      ),
    });
  } else {
    clauses.push({
      key: "under-way",
      text:
        inProgress.total > 0
          ? `You are partway through ${pluralize(inProgress.total, "thing")}`
          : "Nothing is in progress",
    });
  }
  for (const entry of [firstSoon, nextMovie]) {
    if (!entry) continue;
    clauses.push({
      key: entry.title.mediaId,
      text: (
        <>
          <TitleLink title={entry.title} /> {arrivalVerb(entry)}{" "}
          {midSentence(untilLabel(entry.date, today))}
        </>
      ),
    });
  }

  return (
    <p className="lede">
      {clauses.map((clause, index) => (
        <Fragment key={clause.key}>
          {index > 0 && (index === clauses.length - 1 ? ", and " : ", ")}
          {clause.text}
        </Fragment>
      ))}
      .
      {inProgress.total === 0 && (
        <>
          {" "}
          <Link className="link" href={libraryViewPath({ status: "want" })}>
            Pick something from your want list
          </Link>
          .
        </>
      )}
    </p>
  );
}

/** The top of Home: the day, a greeting by name, and where things stand. */
export function Hello({ name, summary }: { name: string; summary: HomeSummary }) {
  return (
    <header className="hello">
      <span className="label">{longDay(summary.today)}</span>
      <h1 className="d1">{greeting(name)}</h1>
      <Lede summary={summary} />
    </header>
  );
}

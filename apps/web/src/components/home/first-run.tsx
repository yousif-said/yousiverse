import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { greeting, type HomeSummary, longDay } from "@/lib/home";
import { Together } from "./together";

/**
 * Home for someone whose library is empty: the three ways to start, in the order that gets them
 * something to look at soonest. What they already have from other people still shows below.
 */
export function FirstRun({ name, summary }: { name: string; summary: HomeSummary }) {
  const hasOthers =
    summary.activity.length > 0 || summary.cameThrough.length > 0 || summary.discussions.length > 0;

  return (
    <div className="page page--narrow">
      <header className="hello">
        <span className="label">{longDay(summary.today)}</span>
        <h1 className="d1">{greeting(name)}</h1>
        <p className="lede">
          Your library is empty, so this is where it starts. Add what you are watching, playing, and
          reading, and Home becomes the place to pick it all back up.
        </p>
      </header>

      <section aria-labelledby="start-h">
        <SectionHead id="start-h" title="Three ways to start" />
        <ol className="steps">
          <li className="step">
            <div>
              <h3>Find something you love</h3>
              <p className="dim">
                Search for a movie, a show, a game, or a book, then say where you are with it: want,
                in progress, finished, or dropped.
              </p>
              <Link className="btn btn--primary mt-3.5" href="/search">
                <Icon name="search" />
                Search the catalog
              </Link>
            </div>
          </li>
          <li className="step">
            <div>
              <h3>Bring your history</h3>
              <p className="dim">
                Import what you have already logged on Letterboxd, IMDb, Goodreads, StoryGraph,
                Steam, or Trakt. Nothing you add here is ever overwritten.
              </p>
              <Link className="btn btn--soft mt-3.5" href="/import">
                <Icon name="import" />
                Import your history
              </Link>
            </div>
          </li>
          <li className="step">
            <div>
              <h3>Follow people</h3>
              <p className="dim">
                See what friends are watching, playing, and reading, and what they made of it.
                Following needs no approval.
              </p>
              <Link className="btn btn--soft mt-3.5" href="/feed">
                <Icon name="feed" />
                Find people to follow
              </Link>
            </div>
          </li>
        </ol>
      </section>

      {hasOthers && <Together summary={summary} />}
    </div>
  );
}

import { signInMethods } from "@yousiverse/auth";
import Link from "next/link";
import { Artwork } from "@/components/media/artwork";
import { Logo } from "@/components/shell/logo";
import { SignInForm } from "@/components/sign-in-form";
import { Icon } from "@/components/ui/icon";
import { wallColumns } from "@/lib/home";
import { getQueryClient, trpc } from "@/trpc/server";

const WALL_COLUMNS = 4;

/** Artwork drifting behind the door. Decorative, so it is hidden from screen readers. */
async function Wall() {
  const titles = await getQueryClient().fetchQuery(trpc.home.wall.queryOptions());
  return (
    <div className="door__wall" aria-hidden="true">
      {wallColumns(titles, WALL_COLUMNS).map((column, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the columns are fixed positions, never reordered.
        <div key={index} className="door__col">
          {/* Each column holds its titles twice, so its drift can loop without a seam. */}
          {["first", "again"].flatMap((pass) =>
            column.map((title) => (
              <Artwork key={`${pass}:${title.mediaId}`} title={title} link={false} />
            )),
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * The front door: what a visitor who is not signed in sees at `/` and at `/sign-in`. It says
 * what the app is, signs them in, and sends them on to `redirectTo`. The shell hides itself
 * around it, so it carries the artwork's credits itself.
 */
export function Door({ redirectTo }: { redirectTo: string }) {
  return (
    <div className="door">
      <div className="door__copy">
        <Link className="brand" href="/" style={{ padding: 0 }}>
          <Logo />
          <span>Yousiverse</span>
        </Link>
        <h1 className="d1 mt-5">Everything you watch, play, and read. One universe.</h1>
        <p className="lede">
          Keep your movies, shows, games, and books in one library. Rate them to the quarter point,
          see where to watch them, and follow a story across every medium it touches.
        </p>
        <SignInForm methods={signInMethods} redirectTo={redirectTo} />
        <ul className="door__points">
          <li>
            <Icon name="orbit" />
            <span>
              <b style={{ color: "var(--fg)" }}>Follow the story, not the format.</b> The book, its
              film, the series, and the game sit on one map.
            </span>
          </li>
          <li>
            <Icon name="play" />
            <span>
              <b style={{ color: "var(--fg)" }}>Know where it is tonight.</b> Your own subscriptions
              first, with alerts when something arrives or a price drops.
            </span>
          </li>
          <li>
            <Icon name="import" />
            <span>
              <b style={{ color: "var(--fg)" }}>Bring your history.</b> Letterboxd, IMDb, Goodreads,
              StoryGraph, Steam, and Trakt.
            </span>
          </li>
        </ul>
        <p className="hint door__credits">
          Artwork comes from <a href="https://www.themoviedb.org">TMDB</a>,{" "}
          <a href="https://www.igdb.com">IGDB</a>, and{" "}
          <a href="https://openlibrary.org">Open Library</a>. This product uses the TMDB API but is
          not endorsed or certified by TMDB.
        </p>
      </div>
      <Wall />
      <div className="door__glow" />
    </div>
  );
}

import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { hueOf } from "@/lib/hue";
import { Logo } from "./logo";
import { MeMenu } from "./me-menu";
import { NavLink } from "./nav-link";
import { SearchTrigger } from "./search-trigger";
import type { Viewer } from "./viewer";

type Item = { href: string; label: string; icon: IconName; exact?: boolean };

const YOURS: Item[] = [
  { href: "/", label: "Home", icon: "home", exact: true },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/youniverses", label: "Youniverses", icon: "orbit" },
  { href: "/recommendations", label: "For you", icon: "spark" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];
const TOGETHER: Item[] = [
  { href: "/feed", label: "Feed", icon: "feed" },
  { href: "/clubs", label: "Clubs", icon: "clubs", exact: true },
  { href: "/lists", label: "Lists", icon: "list" },
];
/** What a visitor can open without an account. */
const OPEN_TO_ALL = new Set(["/", "/youniverses", "/calendar", "/clubs"]);

function Items({ items, children }: { items: Item[]; children?: React.ReactNode }) {
  return (
    <>
      {items.map(({ href, label, icon, exact }) => (
        <NavLink key={href} href={href} exact={exact}>
          <Icon name={icon} />
          <span>{label}</span>
        </NavLink>
      ))}
      {children}
    </>
  );
}

/** Every place in the app, grouped: yours, together, your clubs, and what is waiting for you. */
export function Sidebar({ viewer }: { viewer: Viewer | null }) {
  const open = (items: Item[]) =>
    viewer ? items : items.filter((item) => OPEN_TO_ALL.has(item.href));

  return (
    <aside className="side">
      <Link className="brand" href="/" aria-label="Yousiverse, home">
        <Logo />
        <span>Yousiverse</span>
      </Link>
      <SearchTrigger />
      <nav className="nav" aria-label="Yours">
        <Items items={open(YOURS)} />
      </nav>
      <div className="label nav__label">Together</div>
      <nav className="nav" aria-label="Together">
        <Items items={open(TOGETHER)} />
      </nav>
      {viewer && viewer.clubs.length > 0 && (
        <>
          <div className="label nav__label">Your clubs</div>
          <nav className="nav nav--pins" aria-label="Your clubs">
            {viewer.clubs.map((club) => (
              <NavLink key={club.id} href={`/clubs/${club.id}`}>
                <span className="nav__dot">
                  <i style={{ "--h": club.hue ?? hueOf(club.id) } as CSSProperties} />
                </span>
                <span className="truncate">{club.name}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}
      <div className="side__foot">
        {viewer ? (
          <>
            <nav className="nav" aria-label="More">
              <NavLink href="/alerts">
                <Icon name="bell" />
                <span>Alerts</span>
                {viewer.alertsCameThrough > 0 && (
                  <span className="badge">
                    {viewer.alertsCameThrough}
                    <span className="sr-only"> came through</span>
                  </span>
                )}
              </NavLink>
              <NavLink href="/import">
                <Icon name="import" />
                <span>Import</span>
              </NavLink>
            </nav>
            <MeMenu name={viewer.name} username={viewer.username} isReviewer={viewer.isReviewer} />
          </>
        ) : (
          <div className="side__cta">
            <Link className="btn btn--primary" href="/sign-in">
              <Icon name="user" />
              <span>Sign in</span>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

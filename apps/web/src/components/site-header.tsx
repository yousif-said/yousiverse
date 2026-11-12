import { Button } from "@yousiverse/ui/components/button";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <rect x="1" y="5" width="4.5" height="17" rx="1" className="fill-movie" />
      <rect x="6.75" y="2" width="4.5" height="20" rx="1" className="fill-tv" />
      <rect x="12.5" y="8" width="4.5" height="14" rx="1" className="fill-game" />
      <rect x="18.25" y="4" width="4.5" height="18" rx="1" className="fill-book" />
    </svg>
  );
}

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:gap-8 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm font-display text-xl font-extrabold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Logo />
          <span className="sr-only sm:not-sr-only">Yousiverse</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {/* The logo already links home, so small screens drop this to make room. */}
          <NavLink href="/" className="hidden sm:block">
            Home
          </NavLink>
          <NavLink href="/search">Search</NavLink>
          {session && <NavLink href="/library">Library</NavLink>}
          {/* Small screens reach lists from the library page instead. */}
          {session && (
            <NavLink href="/lists" className="hidden sm:block">
              Lists
            </NavLink>
          )}
          <NavLink href="/account">Account</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {!session && (
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

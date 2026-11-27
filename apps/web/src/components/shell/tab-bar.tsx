import { Icon } from "@/components/ui/icon";
import { profilePath } from "@/lib/profile";
import { NavLink } from "./nav-link";
import { SearchTab } from "./search-trigger";
import type { Viewer } from "./viewer";

/** The five places a phone reaches with a thumb. The sidebar's other places are in "You". */
export function TabBar({ viewer }: { viewer: Viewer | null }) {
  const you = viewer?.username ? profilePath(viewer.username) : "/account";

  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink href="/" exact>
        <Icon name="home" size="lg" />
        Home
      </NavLink>
      {viewer && (
        <NavLink href="/library">
          <Icon name="library" size="lg" />
          Library
        </NavLink>
      )}
      <SearchTab />
      <NavLink href="/calendar">
        <Icon name="calendar" size="lg" />
        Calendar
      </NavLink>
      {viewer ? (
        <NavLink href={you}>
          <Icon name="user" size="lg" />
          You
        </NavLink>
      ) : (
        <NavLink href="/sign-in">
          <Icon name="user" size="lg" />
          Sign in
        </NavLink>
      )}
    </nav>
  );
}

"use client";

import { Icon } from "@/components/ui/icon";
import { openPalette } from "./command-palette";

/** Search, at the top of the sidebar: opens the palette, as ⌘K does. */
export function SearchTrigger() {
  return (
    // Named outright: on a narrow sidebar the word is hidden and only the icon shows.
    <button
      type="button"
      className="side__search"
      aria-label="Search"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={openPalette}
    >
      <Icon name="search" />
      <span>Search</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}

/** Search, in the middle of the mobile bar. */
export function SearchTab() {
  return (
    <button type="button" onClick={openPalette}>
      <Icon name="search" size="lg" />
      Search
    </button>
  );
}

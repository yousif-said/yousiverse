"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";

const never = () => () => {};

/** Night or day, for the whole app. The choice is kept in this browser. */
export function AppearanceChoice() {
  const { resolvedTheme, setTheme } = useTheme();
  // The stored choice is only known in the browser. Until the page is live there, show the
  // default, night, so the server and the browser draw the same thing first.
  const live = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  const isNight = !live || resolvedTheme !== "light";

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset cannot be laid out as one segmented row.
    <div className="seg" role="group" aria-label="Appearance">
      <button type="button" aria-pressed={isNight} onClick={() => setTheme("dark")}>
        <Icon name="moon" size="sm" />
        Night
      </button>
      <button type="button" aria-pressed={!isNight} onClick={() => setTheme("light")}>
        <Icon name="sun" size="sm" />
        Day
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

const DECISIONS: Record<string, string> = { a: "approve", r: "reject" };

/** Where a letter is being typed or already means something, so it must not settle a link. */
const TAKES_LETTERS = 'input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]';

/**
 * Lets a reviewer work through the queue from the keyboard: A approves and R rejects the
 * suggestion the focus is in, or the first one when the focus is elsewhere.
 */
export function ReviewKeys({ children }: { children: React.ReactNode }) {
  const queue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const decision = DECISIONS[event.key.toLowerCase()];
      if (!decision || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.target instanceof Element && event.target.closest(TAKES_LETTERS)) return;

      const focused = document.activeElement?.closest(".pair");
      const card =
        focused && queue.current?.contains(focused)
          ? focused
          : queue.current?.querySelector(".pair");
      card?.querySelector<HTMLButtonElement>(`[data-decision="${decision}"]`)?.click();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return <div ref={queue}>{children}</div>;
}

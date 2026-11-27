"use client";

import { useEffect } from "react";

/**
 * Brings one part of a page to the top of the window when the page opens, for an address that
 * names what is in it. Without this, a link to someone's followers would open their profile
 * with the list below the fold.
 */
export function ScrollToSections({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}

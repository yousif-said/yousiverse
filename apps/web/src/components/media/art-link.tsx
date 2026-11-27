"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useRef, useState, ViewTransition } from "react";

type Props = ComponentProps<typeof Link> & {
  /** The name the title page's poster answers to. Without one the link is an ordinary link. */
  morph?: string;
};

/** A plain click, which opens the page here; not one that opens a new tab or window. */
function opensHere(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Artwork that links to its title, and grows into that page's poster when it is opened.
 *
 * A title can be on a page several times and a transition name must be on one element only, so
 * the name is given at the click, to the artwork that was clicked. A click on the title written
 * under a card counts as a click on the card's artwork.
 */
export function ArtLink({ morph, ...props }: Props) {
  const link = useRef<HTMLAnchorElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const scope = link.current?.closest(".card") ?? link.current;
    if (!morph || !scope) return;
    const name = (event: Event) => {
      const opened = event.target instanceof Element && event.target.closest("a");
      if (opened && opensHere(event as MouseEvent)) setLeaving(true);
    };
    scope.addEventListener("click", name, true);
    return () => scope.removeEventListener("click", name, true);
  }, [morph]);

  return (
    <ViewTransition name={leaving ? morph : undefined} share="morph" default="none">
      <Link ref={link} {...props} />
    </ViewTransition>
  );
}

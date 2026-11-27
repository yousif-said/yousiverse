import type { CSSProperties } from "react";
import { hueOf } from "@/lib/hue";

type Props = {
  /** Null for a person who has not chosen a username. */
  username: string | null | undefined;
  /** Diameter in pixels. The design's default is 32. */
  size?: number;
  /** The tooltip, when it should say more than the username. */
  title?: string;
};

function initialsOf(username: string): string {
  const parts = username.split("_").filter(Boolean);
  const [first = "", second] = parts;
  return (second ? `${first[0]}${second[0]}` : first.slice(0, 2)).toUpperCase();
}

/**
 * A person's mark: their initials on a gradient made from their username. Decorative, because
 * a name is always written next to it.
 */
export function Avatar({ username, size, title }: Props) {
  const sized: Record<string, string> = size ? { "--sz": `${size}px` } : {};
  if (!username) {
    return (
      <span
        className="av"
        aria-hidden="true"
        style={{ ...sized, "--h": 40, filter: "grayscale(1)" } as CSSProperties}
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="av"
      aria-hidden="true"
      title={title ?? `@${username}`}
      style={{ ...sized, "--h": hueOf(username) } as CSSProperties}
    >
      {initialsOf(username)}
    </span>
  );
}

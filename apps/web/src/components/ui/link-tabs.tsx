import { cn } from "cn";
import Link from "next/link";
import { Icon, type IconName } from "./icon";

export type LinkChoice = {
  href: string;
  label: React.ReactNode;
  current: boolean;
  /** A count shown after the label, in tabs. */
  count?: number;
  icon?: IconName;
  /** A class for the icon, such as a medium's color (`c-movie`). */
  iconClassName?: string;
};

type Props = {
  /** Names the group for screen readers: "Filter by type". */
  label: string;
  choices: LinkChoice[];
  className?: string;
};

function Choices({ choices, scroll }: { choices: LinkChoice[]; scroll?: boolean }) {
  return choices.map(({ href, label, current, count, icon, iconClassName }) => (
    <Link key={href} href={href} aria-current={current ? "true" : undefined} scroll={scroll}>
      {icon && <Icon name={icon} size="sm" className={iconClassName} />}
      {label}
      {count !== undefined && (
        <>
          {/* Spoken between the two, so the link is "Library, 44" and not "Library44". */}
          <span className="sr-only">, </span>
          <span className="n">{count.toLocaleString("en-US")}</span>
        </>
      )}
    </Link>
  ));
}

/**
 * Underlined tabs that are links, so each view keeps its own address. Use for the main split
 * of a page (by medium, by section).
 */
export function LinkTabs({ label, choices, className }: Props) {
  return (
    <nav aria-label={label} className={cn("tabs", className)}>
      <Choices choices={choices} scroll={false} />
    </nav>
  );
}

/** A segmented control whose segments are links. Use for a second, smaller choice. */
export function LinkSegmented({ label, choices, className, small }: Props & { small?: boolean }) {
  return (
    <nav aria-label={label} className={cn("seg", small && "seg--sm", className)}>
      <Choices choices={choices} scroll={false} />
    </nav>
  );
}

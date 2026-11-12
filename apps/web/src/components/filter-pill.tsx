import { cn } from "cn";
import Link from "next/link";

type Props = { href: string; selected: boolean; color?: string; children: React.ReactNode };

/** One choice in a row of filters that are links, so every filtered view has its own URL. */
export function FilterPill({ href, selected, color, children }: Props) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current]:border-foreground aria-[current]:bg-foreground aria-[current]:text-background"
    >
      {color && <span className={cn("size-2.5 rounded-[2px]", color)} />}
      {children}
    </Link>
  );
}

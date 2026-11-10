"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isCurrent = usePathname() === href;

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
    >
      {children}
    </Link>
  );
}

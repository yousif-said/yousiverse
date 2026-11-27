"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  /** Current only on exactly this address. Otherwise pages beneath it count too. */
  exact?: boolean;
  children: React.ReactNode;
};

/** A link in the sidebar or the mobile bar that knows when you are in its part of the app. */
export function NavLink({ href, exact = false, children }: Props) {
  const pathname = usePathname();
  const isCurrent = pathname === href || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} aria-current={isCurrent ? "page" : undefined}>
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A small button that takes a visitor to sign in and brings them back to this page. */
export function SignInButton({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Link className="btn btn--sm btn--soft" href={`/sign-in?next=${encodeURIComponent(pathname)}`}>
      {children}
    </Link>
  );
}

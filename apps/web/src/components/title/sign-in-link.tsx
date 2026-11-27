"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Sign in", bringing the visitor back to the page they are on. */
export function SignInLink() {
  const pathname = usePathname();
  return (
    <Link className="link" href={`/sign-in?next=${encodeURIComponent(pathname)}`}>
      Sign in
    </Link>
  );
}

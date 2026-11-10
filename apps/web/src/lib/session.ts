import { auth } from "@yousiverse/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** For protected pages: returns the session, or sends the visitor to sign in and back. */
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}

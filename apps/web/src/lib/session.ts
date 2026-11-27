import { redirect } from "next/navigation";
import { getContext } from "@/trpc/server";

/** The session of whoever is asking for this page, looked up once however often it is asked for. */
export async function getSession() {
  return (await getContext()).session;
}

/** For protected pages: returns the session, or sends the visitor to sign in and back. */
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}

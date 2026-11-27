import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Door } from "@/components/home/door";
import { safeRedirectPath } from "@/lib/redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

/** The front door again, sending the visitor on to the page they were after once signed in. */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectPath(typeof next === "string" ? next : undefined);

  if (await getSession()) redirect(redirectTo);

  return <Door redirectTo={redirectTo} />;
}

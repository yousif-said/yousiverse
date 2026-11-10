import { signInMethods } from "@yousiverse/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { safeRedirectPath } from "@/lib/redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectPath(typeof next === "string" ? next : undefined);

  if (await getSession()) redirect(redirectTo);

  return (
    <section className="mx-auto max-w-sm pt-16 sm:pt-24">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-3 text-muted-foreground">Pick up your shelf where you left it.</p>
      <SignInForm methods={signInMethods} redirectTo={redirectTo} />
    </section>
  );
}

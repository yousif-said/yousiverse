"use client";

import type { SignInMethods } from "@yousiverse/auth";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = { methods: SignInMethods; redirectTo: string };

export function SignInForm({ methods, redirectTo }: Props) {
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  async function signInWithGoogle() {
    setErrorMessage(undefined);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    });
    if (error) setErrorMessage(error.message ?? "Could not reach Google. Try again.");
  }

  async function sendSignInLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setErrorMessage(undefined);
    setEmailStatus("sending");
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: redirectTo });
    if (error) {
      setErrorMessage(error.message ?? "Could not send the sign-in link. Try again.");
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("sent");
  }

  const beforeNote = methods.linkIsPrinted
    ? "Development only: the link prints in the terminal instead of being emailed."
    : "We will email you a link that signs you in. No password needed, and it works for new accounts too.";
  const sentNote = methods.linkIsPrinted
    ? "Sign-in link sent. Open it from the terminal running the dev server."
    : `Sign-in link sent. Check your inbox; the link works for ${methods.linkMinutes} minutes.`;

  return (
    <div className="mt-8 space-y-6">
      {methods.google && (
        <Button variant="outline" size="lg" className="w-full" onClick={signInWithGoogle}>
          <GoogleLogo />
          Continue with Google
        </Button>
      )}

      {methods.google && (
        <p className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or use your email
          <span className="h-px flex-1 bg-border" />
        </p>
      )}

      <form onSubmit={sendSignInLink} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="h-10 bg-card"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={emailStatus === "sending"}>
          Send sign-in link
        </Button>
        <p className="text-sm text-muted-foreground" role="status">
          {emailStatus === "sent" ? sentNote : beforeNote}
        </p>
      </form>

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[18px]">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

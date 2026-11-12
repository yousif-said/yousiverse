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

  if (!methods.google && !methods.devEmail) {
    return (
      <p className="mt-8 rounded-lg border bg-card p-4 text-sm">
        Sign-in isn&apos;t set up yet. Add Google credentials to the environment.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {methods.google && (
        <Button variant="outline" size="lg" className="w-full" onClick={signInWithGoogle}>
          Continue with Google
        </Button>
      )}

      {methods.devEmail && (
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
            {emailStatus === "sent"
              ? "Sign-in link sent. Open it from the terminal running the dev server."
              : "Development only: the link prints in the terminal instead of being emailed."}
          </p>
        </form>
      )}

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

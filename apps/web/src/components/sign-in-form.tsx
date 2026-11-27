"use client";

import type { SignInMethods } from "@yousiverse/auth";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = { methods: SignInMethods; redirectTo: string };

/** How long "Send again" stays off after a link goes out, so one slow email is not asked for twice. */
const SEND_AGAIN_WAIT_SECONDS = 30;

/**
 * The front door's sign-in panel: Google where it is set up, and a sign-in link by email. Once a
 * link is sent the panel becomes "Check your email", so it cannot be asked for twice by accident.
 */
export function SignInForm({ methods, redirectTo }: Props) {
  const [sentTo, setSentTo] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [secondsUntilSendAgain, setSecondsUntilSendAgain] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    if (secondsUntilSendAgain === 0) return;
    const timer = setTimeout(() => setSecondsUntilSendAgain((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsUntilSendAgain]);

  async function signInWithGoogle() {
    setErrorMessage(undefined);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: redirectTo,
    });
    if (error) setErrorMessage(error.message ?? "Could not reach Google. Try again.");
  }

  async function sendSignInLink(email: string) {
    setErrorMessage(undefined);
    setIsSending(true);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: redirectTo });
    setIsSending(false);
    if (error) {
      setErrorMessage(error.message ?? "Could not send the sign-in link. Try again.");
      return;
    }
    setSentTo(email);
    setSecondsUntilSendAgain(SEND_AGAIN_WAIT_SECONDS);
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendSignInLink(String(new FormData(event.currentTarget).get("email")));
  }

  function changeEmail() {
    setErrorMessage(undefined);
    setSentTo(undefined);
  }

  const error = errorMessage && (
    <p className="error" role="alert">
      {errorMessage}
    </p>
  );

  if (sentTo) {
    return (
      <div className="sent">
        <div className="sent__what" role="status">
          <h2 className="d3">Check your email</h2>
          <p className="dim">
            We sent a sign-in link to{" "}
            <b className="break-words" style={{ color: "var(--fg)" }}>
              {sentTo}
            </b>
            . It works once, for the next {methods.linkMinutes} minutes.
          </p>
          {methods.linkIsPrinted && (
            <p className="hint">
              Development only: nothing was emailed. Open the link from the terminal running the dev
              server.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className="btn btn--soft"
            disabled={isSending || secondsUntilSendAgain > 0}
            onClick={() => sendSignInLink(sentTo)}
          >
            {isSending
              ? "Sending…"
              : secondsUntilSendAgain > 0
                ? `Send again in ${secondsUntilSendAgain}s`
                : "Send again"}
          </button>
        </div>
        <button type="button" className="hint link self-start" onClick={changeEmail}>
          Use a different email
        </button>
        {error}
      </div>
    );
  }

  return (
    <div className="door__cta">
      {methods.google && (
        <>
          <button type="button" className="btn btn--primary btn--lg" onClick={signInWithGoogle}>
            Continue with Google
          </button>
          <div className="door__or">or</div>
        </>
      )}
      <form className="door__form" onSubmit={submitEmail}>
        <label className="sr-only" htmlFor="email">
          Email
        </label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        {/* With no Google button above it, the link is the one thing to do here. */}
        <button
          className={cn("btn btn--lg", methods.google ? "btn--soft" : "btn--primary")}
          type="submit"
          disabled={isSending}
        >
          {isSending ? "Sending…" : "Send sign-in link"}
        </button>
      </form>
      <p className="hint">
        {methods.linkIsPrinted
          ? "Development only: the link prints in the terminal instead of being emailed."
          : "No password. The first link creates your account."}
      </p>
      {error}
    </div>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

const NOT_SAVED = "That did not go through. Check your connection and try again.";

/** Turns the signed-in person's alert emails on or off. */
export function AlertEmailsToggle({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const router = useRouter();
  const setEmails = useMutation(trpc.alerts.setEmails.mutationOptions());
  const [checked, setChecked] = useState(enabled);
  const [problem, setProblem] = useState<string>();

  async function change(event: React.ChangeEvent<HTMLInputElement>) {
    const wanted = event.target.checked;
    // Shown at once; put back if it could not be saved.
    setChecked(wanted);
    setProblem(undefined);
    try {
      await setEmails.mutateAsync({ enabled: wanted });
      router.refresh();
    } catch {
      setChecked(!wanted);
      setProblem(NOT_SAVED);
    }
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={checked}
          disabled={setEmails.isPending}
          onChange={change}
          className="size-4 accent-primary"
        />
        Email me when an alert comes through
      </label>
      {problem && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

export function RemoveAlertButton({ alertId, label }: { alertId: string; label: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const remove = useMutation(trpc.alerts.remove.mutationOptions());

  async function removeAlert() {
    try {
      await remove.mutateAsync({ id: alertId });
      router.refresh();
    } catch {
      window.alert(NOT_SAVED);
    }
  }

  return (
    <button
      type="button"
      onClick={removeAlert}
      disabled={remove.isPending}
      aria-label={label}
      className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      Remove
    </button>
  );
}

/** Stops alert emails for whoever holds an unsubscribe link, without signing in. */
export function UnsubscribeButton({ token }: { token: string }) {
  const trpc = useTRPC();
  const unsubscribe = useMutation(trpc.alerts.unsubscribe.mutationOptions());
  const [state, setState] = useState<"asking" | "done" | "failed">("asking");

  async function stop() {
    try {
      await unsubscribe.mutateAsync({ token });
      setState("done");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="mt-6 max-w-[65ch]">
        Done. You will not get alert emails any more. Your alerts are still kept, and you can turn
        the emails back on from your alerts page.
      </p>
    );
  }
  return (
    <div className="mt-6">
      <Button type="button" onClick={stop} disabled={unsubscribe.isPending}>
        Stop alert emails
      </Button>
      {state === "failed" && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {NOT_SAVED}
        </p>
      )}
    </div>
  );
}

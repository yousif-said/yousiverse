"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

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
      <div className="note" role="status">
        <span>
          Done. You will not get alert emails any more. Your alerts are still kept, and you can turn
          the emails back on from your alerts page.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="button" onClick={stop} disabled={unsubscribe.isPending}>
        Stop alert emails
      </Button>
      {state === "failed" && (
        <p role="alert" className="error">
          That did not go through. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

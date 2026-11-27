"use client";

import { useMutation } from "@tanstack/react-query";
import { Switch } from "@yousiverse/ui/components/switch";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

/** Turns the signed-in person's alert emails on or off. The change is saved at once. */
export function AlertEmailsSwitch({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const router = useRouter();
  const setEmails = useMutation(trpc.alerts.setEmails.mutationOptions());
  const [checked, setChecked] = useState(enabled);
  const [failed, setFailed] = useState(false);

  async function change(wanted: boolean) {
    // Shown at once; put back if it could not be saved.
    setChecked(wanted);
    setFailed(false);
    try {
      await setEmails.mutateAsync({ enabled: wanted });
      router.refresh();
    } catch {
      setChecked(!wanted);
      setFailed(true);
    }
  }

  return (
    <span className="control">
      <Switch
        aria-label="Alert emails"
        checked={checked}
        disabled={setEmails.isPending}
        onCheckedChange={change}
      />
      {failed && (
        <span role="alert" className="error">
          That did not go through. Check your connection and try again.
        </span>
      )}
    </span>
  );
}

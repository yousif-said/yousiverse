"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  alertId: string;
  /** Names the button, saying which alert it removes. */
  label: string;
};

/** Removes one of the signed-in person's alerts, waiting or come through. */
export function RemoveAlertButton({ alertId, label }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const remove = useMutation(trpc.alerts.remove.mutationOptions());
  const [failed, setFailed] = useState(false);

  async function removeAlert() {
    setFailed(false);
    try {
      await remove.mutateAsync({ id: alertId });
      toast("Alert removed");
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <span className="control">
      <button
        type="button"
        className="iconbtn iconbtn--sm"
        onClick={removeAlert}
        disabled={remove.isPending}
        aria-label={label}
      >
        <Icon name="x" size="sm" />
      </button>
      {failed && (
        <span role="alert" className="error">
          That did not go through. Check your connection and try again.
        </span>
      )}
    </span>
  );
}

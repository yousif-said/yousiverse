"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  linkId: string;
  /** The link in words, for the question and the button's accessible name. */
  summary: string;
};

/** Takes a verified link off both of its titles, after asking. */
export function RemoveLinkButton({ linkId, summary }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const removeLink = useMutation(trpc.links.remove.mutationOptions());
  const [failed, setFailed] = useState(false);

  async function remove() {
    if (!window.confirm(`Remove this link? ${summary}`)) return;
    setFailed(false);
    try {
      await removeLink.mutateAsync({ id: linkId });
    } catch (error) {
      console.error("Removing a link failed.", error);
      setFailed(true);
      return;
    }
    toast("Link removed. It no longer shows on either title.");
    router.refresh();
  }

  return (
    <span className="row__end">
      {failed && (
        <span role="alert" className="error">
          That did not go through. Try again.
        </span>
      )}
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        onClick={remove}
        disabled={removeLink.isPending}
        aria-label={`Remove link: ${summary}`}
      >
        Remove
      </button>
    </span>
  );
}

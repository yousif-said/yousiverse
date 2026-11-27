"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = { clubId: string; mediaId: string; title: string };

/** Takes a title out of a club's picks, for the member who picked it and for the club's owner. */
export function RemovePickButton({ clubId, mediaId, title }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const removePick = useMutation(trpc.clubs.removePick.mutationOptions());

  async function remove() {
    setFailed(false);
    try {
      await removePick.mutateAsync({ id: clubId, mediaId });
      toast("Removed from the club's picks");
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className="hint link"
        onClick={remove}
        disabled={removePick.isPending}
        aria-label={`Remove ${title} from this club's picks`}
      >
        Remove
      </button>
      {failed && (
        <span className="error block" role="alert">
          Could not remove it. Try again.
        </span>
      )}
    </>
  );
}

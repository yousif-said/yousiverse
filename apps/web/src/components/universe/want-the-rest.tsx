"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

// The API adds this many titles in one request.
const TITLES_PER_REQUEST = 60;

type RestProps = {
  universeName: string;
  /** The titles of the universe that are not in the person's library. */
  mediaIds: string[];
  /** What the button says: "Want the other 5". */
  label: string;
};

/** Puts every title of a universe that is not in the person's library on their want list. */
export function WantTheRest({ universeName, mediaIds, label }: RestProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const saveMany = useMutation(trpc.library.saveMany.mutationOptions());
  const [failed, setFailed] = useState(false);

  async function wantAll() {
    setFailed(false);
    try {
      for (let start = 0; start < mediaIds.length; start += TITLES_PER_REQUEST) {
        const batch = mediaIds.slice(start, start + TITLES_PER_REQUEST);
        await saveMany.mutateAsync({ mediaIds: batch, status: "want" });
      }
      toast(`The rest of ${universeName} is on your want list`);
    } catch {
      setFailed(true);
    }
    // Even a run that stopped partway has added some, and the page should show them.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--sm btn--soft"
        style={{ marginLeft: 8 }}
        disabled={saveMany.isPending}
        onClick={wantAll}
      >
        <Icon name="plus" size="sm" />
        {label}
      </button>
      {failed && (
        <p role="alert" className="error">
          Not all of them could be added. Check your connection and try again.
        </p>
      )}
    </>
  );
}

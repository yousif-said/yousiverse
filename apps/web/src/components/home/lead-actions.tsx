"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  episodeId: string;
  episodeNumber: number;
  /** The episode's own page, for rating it. */
  episodeHref: string;
};

/**
 * What to do with the episode Home leads with: mark it watched, which moves Home on to the next
 * one, or open it to rate it.
 */
export function LeadActions({ episodeId, episodeNumber, episodeHref }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const setWatched = useMutation(trpc.library.setWatched.mutationOptions());
  const [isMovingOn, startMovingOn] = useTransition();
  const [failed, setFailed] = useState(false);

  async function markWatched() {
    setFailed(false);
    try {
      await setWatched.mutateAsync({ episodeId, watched: true });
    } catch {
      setFailed(true);
      return;
    }
    toast(`Episode ${episodeNumber} marked watched`);
    startMovingOn(() => router.refresh());
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn btn--primary"
          disabled={setWatched.isPending || isMovingOn}
          onClick={markWatched}
        >
          <Icon name="check" />
          Mark episode {episodeNumber} watched
        </button>
        <Link className="btn btn--soft" href={episodeHref}>
          Rate it
        </Link>
      </div>
      {failed && (
        <p className="error" role="alert">
          That episode could not be marked as watched. Check your connection and try again.
        </p>
      )}
    </>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = { episodeId: string; episodeNumber: number; watched: boolean };

/** Marks one episode watched or not. The mark changes at once and goes back if saving fails. */
function useWatched({ episodeId, episodeNumber, watched: initiallyWatched }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const setWatched = useMutation(trpc.library.setWatched.mutationOptions());
  const [watched, setShown] = useState(initiallyWatched);

  async function toggle() {
    if (setWatched.isPending) return;
    const next = !watched;
    setShown(next);
    try {
      await setWatched.mutateAsync({ episodeId, watched: next });
    } catch {
      setShown(!next);
      toast("That did not go through. Check your connection and try again.");
      return;
    }
    toast(next ? `Episode ${episodeNumber} marked watched` : `Episode ${episodeNumber} unmarked`);
    router.refresh();
  }

  return { watched, toggle };
}

/** The round check mark at the end of an episode's row. */
export function WatchedTick(props: Props) {
  const { watched, toggle } = useWatched(props);
  return (
    <button
      type="button"
      className="tick"
      aria-pressed={watched}
      aria-label={`${watched ? "Watched" : "Mark watched"}: episode ${props.episodeNumber}`}
      onClick={toggle}
    >
      <Icon name="check" />
    </button>
  );
}

/** The same mark as a full button, for the top of an episode's own page. */
export function WatchedButton(props: Props) {
  const { watched, toggle } = useWatched(props);
  return (
    <button
      type="button"
      className={cn("btn", watched ? "btn--primary" : "btn--soft")}
      aria-pressed={watched}
      onClick={toggle}
    >
      <Icon name="check" />
      {watched ? "Watched" : "Mark watched"}
    </button>
  );
}

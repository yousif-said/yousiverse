"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type Props = { username: string; initiallyFollowing: boolean };

/** Follows or unfollows the person whose profile this is. */
export function FollowButton({ username, initiallyFollowing }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [failed, setFailed] = useState(false);
  const follow = useMutation(trpc.follows.follow.mutationOptions());
  const unfollow = useMutation(trpc.follows.unfollow.mutationOptions());

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setFailed(false);
    try {
      await (next ? follow : unfollow).mutateAsync({ username });
      router.refresh();
    } catch {
      setFollowing(!next);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        type="button"
        variant={following ? "outline" : "default"}
        aria-pressed={following}
        disabled={follow.isPending || unfollow.isPending}
        onClick={toggle}
      >
        {following ? "Following" : "Follow"}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          That did not go through. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

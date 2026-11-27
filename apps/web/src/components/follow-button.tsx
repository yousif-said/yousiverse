"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  username: string;
  initiallyFollowing: boolean;
  /** Whether this person follows the signed-in person, so that following them makes friends. */
  followsYou?: boolean;
  /** What to call the person when confirming. Defaults to their username. */
  name?: string;
  /** `sm` sits at the end of a row of people; `default` leads a profile. */
  size?: "sm" | "default";
};

/** Follows or unfollows a person. */
export function FollowButton({
  username,
  initiallyFollowing,
  followsYou = false,
  name = `@${username}`,
  size = "sm",
}: Props) {
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
      const friends = followsYou ? ". You are friends now." : "";
      toast(next ? `Following ${name}${friends}` : `Unfollowed ${name}`);
      router.refresh();
    } catch {
      setFollowing(!next);
      setFailed(true);
    }
  }

  return (
    <span className="control">
      <Button
        type="button"
        size={size}
        variant={following ? "secondary" : "default"}
        aria-pressed={following}
        disabled={follow.isPending || unfollow.isPending}
        onClick={toggle}
      >
        {following ? "Following" : followsYou ? "Follow back" : "Follow"}
      </Button>
      {failed && (
        <span role="alert" className="error">
          That did not go through. Check your connection and try again.
        </span>
      )}
    </span>
  );
}

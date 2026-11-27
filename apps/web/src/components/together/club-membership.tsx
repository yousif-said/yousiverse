"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { type Club, clubPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";
import { problemFrom } from "./problem";

type Props = {
  club: Pick<Club, "id" | "name" | "access">;
  isMember: boolean;
  /** The invite code the visitor arrived with, which an invite-only club needs to let them in. */
  invite?: string;
};

/** Joins a club, or leaves it. A club's owner is not shown this: they cannot leave. */
export function ClubMembership({ club, isMember, invite }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const join = useMutation(trpc.clubs.join.mutationOptions());
  const leave = useMutation(trpc.clubs.leave.mutationOptions());
  const inviteOnly = club.access === "invite_only";

  async function change() {
    // There is no way back into an invite-only club without its link, so make sure first.
    if (isMember && inviteOnly && !window.confirm(`Leave ${club.name}?`)) return;
    setProblem(undefined);
    try {
      if (isMember) {
        await leave.mutateAsync({ id: club.id });
        toast(`You left ${club.name}`);
        // An invite-only club disappears for someone who has left it.
        if (inviteOnly) router.push("/clubs");
      } else {
        await join.mutateAsync({ id: club.id, invite });
        toast(`You joined ${club.name}`);
        router.replace(clubPath(club.id));
      }
      router.refresh();
    } catch (error) {
      setProblem(
        problemFrom(error, "That did not go through. Check your connection and try again."),
      );
    }
  }

  const isPending = join.isPending || leave.isPending;
  return (
    <>
      {isMember ? (
        <button type="button" className="btn btn--soft" disabled={isPending} onClick={change}>
          Leave club
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={isPending}
          onClick={change}
        >
          <Icon name="plus" />
          Join club
        </button>
      )}
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}

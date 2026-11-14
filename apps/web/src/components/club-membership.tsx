"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type Props = { clubId: string; isMember: boolean; invite?: string };

/** Joins a club, or leaves it. A club's owner is not shown this: they cannot leave. */
export function ClubMembership({ clubId, isMember, invite }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const join = useMutation(trpc.clubs.join.mutationOptions());
  const leave = useMutation(trpc.clubs.leave.mutationOptions());

  async function change() {
    if (isMember && !window.confirm("Leave this club?")) return;
    setProblem(undefined);
    try {
      if (isMember) {
        await leave.mutateAsync({ id: clubId });
        // An invite-only club disappears for someone who has left it.
        router.push("/clubs");
      } else {
        await join.mutateAsync({ id: clubId, invite });
        router.replace(`/clubs/${clubId}`);
      }
      router.refresh();
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      setProblem(
        data?.code === "PRECONDITION_FAILED" && message
          ? message
          : "That did not go through. Check your connection and try again.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        type="button"
        variant={isMember ? "outline" : "default"}
        disabled={join.isPending || leave.isPending}
        onClick={change}
      >
        {isMember ? "Leave club" : "Join club"}
      </Button>
      {problem && (
        <p role="alert" className="max-w-[65ch] text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

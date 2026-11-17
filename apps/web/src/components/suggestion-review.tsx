"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type Props = {
  suggestionId: string;
  /** The suggestion in words, for the buttons' accessible names. */
  summary: string;
};

/** Approves or rejects one suggested link. */
export function SuggestionReview({ suggestionId, summary }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const approve = useMutation(trpc.links.approve.mutationOptions());
  const reject = useMutation(trpc.links.reject.mutationOptions());
  const [problem, setProblem] = useState<string>();

  async function decide(decision: typeof approve | typeof reject) {
    setProblem(undefined);
    try {
      await decision.mutateAsync({ id: suggestionId });
      router.refresh();
    } catch (error) {
      const { data } = error as { data?: { code?: string } };
      setProblem(
        data?.code === "NOT_FOUND"
          ? "One of these titles could not be found at its source. Reject the suggestion if the title no longer exists."
          : "That did not go through. Try again in a little while.",
      );
    }
  }

  const busy = approve.isPending || reject.isPending;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={busy}
        aria-label={`Approve: ${summary}`}
        onClick={() => decide(approve)}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        aria-label={`Reject: ${summary}`}
        onClick={() => decide(reject)}
      >
        Reject
      </Button>
      {problem && (
        <p role="alert" className="w-full text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}

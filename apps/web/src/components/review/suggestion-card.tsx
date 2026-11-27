"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  suggestionId: string;
  /** The suggestion in words, for the buttons' accessible names. */
  summary: string;
  /** The two titles and what is said about them. */
  children: React.ReactNode;
};

type Decision = "approve" | "reject";

const SETTLED: Record<Decision, string> = {
  approve: "Link approved. It now shows on both titles.",
  reject: "Suggestion rejected. It will not be raised again.",
};

/** One suggested link waiting in the queue, with the two buttons that settle it. */
export function SuggestionCard({ suggestionId, summary, children }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const approve = useMutation(trpc.links.approve.mutationOptions());
  const reject = useMutation(trpc.links.reject.mutationOptions());
  const [settled, setSettled] = useState(false);
  const [problem, setProblem] = useState<string>();
  // A ref as well as state: two key presses can land before the buttons redraw as busy.
  const deciding = useRef(false);
  const busy = approve.isPending || reject.isPending;

  /** Keeps a keyboard in the queue: the card is about to go, so its neighbor takes the focus. */
  function passFocusOn() {
    const here = card.current;
    if (!here?.contains(document.activeElement)) return;
    const neighbor = here.nextElementSibling ?? here.previousElementSibling;
    neighbor?.querySelector<HTMLElement>("[data-decision]")?.focus();
  }

  async function decide(decision: Decision) {
    if (deciding.current) return;
    deciding.current = true;
    setProblem(undefined);
    try {
      await (decision === "approve" ? approve : reject).mutateAsync({ id: suggestionId });
    } catch (error) {
      const { data } = error as { data?: { code?: string } };
      setProblem(
        data?.code === "NOT_FOUND"
          ? "One of these titles could not be found at its source. Reject the suggestion if the title no longer exists."
          : "That did not go through. Try again in a little while.",
      );
      deciding.current = false;
      return;
    }
    passFocusOn();
    setSettled(true);
    toast(SETTLED[decision]);
    router.refresh();
  }

  // Gone at once, so the next key press lands on the next suggestion while the page catches up.
  if (settled) return null;
  return (
    <div className="pair" ref={card}>
      {children}
      <div className="pair__act">
        {/* Marked busy rather than disabled: a disabled button would drop the keyboard's focus. */}
        <button
          type="button"
          className="btn btn--sm btn--primary"
          data-decision="approve"
          aria-disabled={busy}
          aria-label={`Approve: ${summary}`}
          onClick={() => decide("approve")}
        >
          <Icon name="check" size="sm" />
          Approve
        </button>
        <button
          type="button"
          className="btn btn--sm btn--soft"
          data-decision="reject"
          aria-disabled={busy}
          aria-label={`Reject: ${summary}`}
          onClick={() => decide("reject")}
        >
          Reject
        </button>
      </div>
      {problem && (
        <p role="alert" className="error pair__note">
          {problem}
        </p>
      )}
    </div>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clubPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";

type Props =
  /** A whole discussion, which goes back to its club once deleted. */
  | { kind: "discussion"; id: string; clubId: string }
  | { kind: "reply"; id: string; author: string | null };

export function RemovePostButton(props: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const removeDiscussion = useMutation(trpc.discussions.remove.mutationOptions());
  const removeReply = useMutation(trpc.discussions.removeReply.mutationOptions());

  async function remove() {
    const question =
      props.kind === "discussion"
        ? "Delete this discussion and all its replies?"
        : "Delete this reply?";
    if (!window.confirm(question)) return;
    try {
      if (props.kind === "discussion") {
        await removeDiscussion.mutateAsync({ id: props.id });
        router.push(clubPath(props.clubId));
      } else {
        await removeReply.mutateAsync({ id: props.id });
      }
      router.refresh();
    } catch {
      window.alert("That could not be deleted. Check your connection and try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={removeDiscussion.isPending || removeReply.isPending}
      aria-label={
        props.kind === "discussion"
          ? "Delete this discussion"
          : `Delete the reply by ${props.author ?? "a former member"}`
      }
      className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
    >
      Delete
    </button>
  );
}

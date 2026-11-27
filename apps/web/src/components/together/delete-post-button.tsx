"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/components/ui/toast";
import { clubPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";

type Props =
  /** A whole discussion, which goes back to its club once deleted. */
  | { kind: "discussion"; id: string; clubId: string }
  | { kind: "reply"; id: string; author: string | null };

/** Deletes a discussion or one reply to it, for whoever wrote it and for the club's owner. */
export function DeletePostButton(props: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const removeDiscussion = useMutation(trpc.discussions.remove.mutationOptions());
  const removeReply = useMutation(trpc.discussions.removeReply.mutationOptions());

  async function remove() {
    const question =
      props.kind === "discussion"
        ? "Delete this discussion and all its replies?"
        : "Delete this reply?";
    if (!window.confirm(question)) return;
    setFailed(false);
    try {
      if (props.kind === "discussion") {
        await removeDiscussion.mutateAsync({ id: props.id });
        router.push(clubPath(props.clubId));
      } else {
        await removeReply.mutateAsync({ id: props.id });
      }
      toast("Post deleted");
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className="hint link ml-auto"
        onClick={remove}
        disabled={removeDiscussion.isPending || removeReply.isPending}
        aria-label={
          props.kind === "discussion"
            ? "Delete this discussion"
            : `Delete the reply by ${props.author ?? "a former member"}`
        }
      >
        Delete
      </button>
      {failed && (
        <span className="error" role="alert">
          Could not delete it. Try again.
        </span>
      )}
    </>
  );
}

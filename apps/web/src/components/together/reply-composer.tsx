"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useTRPC } from "@/trpc/client";

type Props = {
  threadId: string;
  /** The member who is replying, for their mark beside the box. */
  username: string | null;
};

/** Where a member adds to a discussion. */
export function ReplyComposer({ threadId, username }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [failed, setFailed] = useState(false);
  const reply = useMutation(trpc.discussions.reply.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFailed(false);
    try {
      await reply.mutateAsync({ threadId, body: String(new FormData(form).get("body")) });
      form.reset();
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <form className="composer" style={{ marginTop: 14 }} onSubmit={submit}>
      <Avatar username={username} size={40} />
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={id}>
          Your reply
        </label>
        <textarea
          id={id}
          name="body"
          className="block w-full"
          placeholder="Add to the discussion"
          required
          maxLength={5000}
        />
        {failed && (
          <p className="error" role="alert">
            Your reply was not posted. Check your connection and try again.
          </p>
        )}
        <div className="composer__bar">
          <span className="hint">Posts cannot be edited after sending.</span>
          <button className="btn btn--primary btn--sm" type="submit" disabled={reply.isPending}>
            Reply
          </button>
        </div>
      </div>
    </form>
  );
}

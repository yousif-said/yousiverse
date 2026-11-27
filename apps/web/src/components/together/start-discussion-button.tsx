"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@yousiverse/ui/components/dialog";
import { Input } from "@yousiverse/ui/components/input";
import { Textarea } from "@yousiverse/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { discussionPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";

/** Opens the dialog that starts a discussion in a club, then goes to the new discussion. */
export function StartDiscussionButton({ clubId }: { clubId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [failed, setFailed] = useState(false);
  const start = useMutation(trpc.discussions.start.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFailed(false);
    try {
      const thread = await start.mutateAsync({
        clubId,
        title: String(form.get("title")),
        body: String(form.get("body")),
      });
      router.push(discussionPath(clubId, thread.id));
    } catch {
      setFailed(true);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="btn btn--sm btn--primary">
          <Icon name="plus" size="sm" />
          Start a discussion
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogTitle>Start a discussion</DialogTitle>
          <div className="field">
            <label htmlFor={`${id}-title`}>Title</label>
            <Input id={`${id}-title`} name="title" required maxLength={120} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-body`}>Opening post</label>
            <Textarea id={`${id}-body`} name="body" required maxLength={5000} />
            <span className="hint">Posts cannot be edited after sending.</span>
          </div>
          {failed && (
            <p className="error" role="alert">
              The discussion could not be started. Check your connection and try again.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="btn btn--ghost">
                Cancel
              </button>
            </DialogClose>
            <button type="submit" className="btn btn--primary" disabled={start.isPending}>
              Post
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

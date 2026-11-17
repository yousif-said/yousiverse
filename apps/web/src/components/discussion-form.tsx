"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { discussionPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";

const textareaClasses =
  "block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const NOT_SAVED = "That did not go through. Check your connection and try again.";

/** Starts a discussion in a club, then opens it. */
export function DiscussionForm({ clubId }: { clubId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const start = useMutation(trpc.discussions.start.mutationOptions());
  const [problem, setProblem] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProblem(undefined);
    try {
      const thread = await start.mutateAsync({
        clubId,
        title: String(form.get("title")),
        body: String(form.get("body")),
      });
      router.push(discussionPath(clubId, thread.id));
    } catch {
      setProblem(NOT_SAVED);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`}>Discussion title</Label>
        <Input id={`${id}-title`} name="title" required maxLength={120} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-body`}>What do you want to talk about?</Label>
        <textarea
          id={`${id}-body`}
          name="body"
          required
          rows={4}
          maxLength={5000}
          className={textareaClasses}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={start.isPending}>
          Start discussion
        </Button>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}

/** Adds a reply to a discussion. */
export function ReplyForm({ threadId }: { threadId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const reply = useMutation(trpc.discussions.reply.mutationOptions());
  const [problem, setProblem] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setProblem(undefined);
    try {
      await reply.mutateAsync({ threadId, body: String(new FormData(formElement).get("body")) });
      formElement.reset();
      router.refresh();
    } catch {
      setProblem(NOT_SAVED);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor={`${id}-body`}>Your reply</Label>
      <textarea
        id={`${id}-body`}
        name="body"
        required
        rows={4}
        maxLength={5000}
        className={`${textareaClasses} bg-card`}
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={reply.isPending}>
          Post reply
        </Button>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}

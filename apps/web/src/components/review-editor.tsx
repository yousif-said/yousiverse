"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { Button } from "@yousiverse/ui/components/button";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { isVisibility, visibilityNote } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { VisibilitySelect } from "./visibility-select";

type Review = NonNullable<RouterOutputs["reviews"]["list"]["mine"]>;
type Props = { target: { mediaId: string } | { episodeId: string }; initialReview: Review | null };

// Matches the limit the API enforces.
const MAX_REVIEW_LENGTH = 10_000;
const linkButton =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The signed-in person's own review: a form to write it, then the review with edit and delete. */
export function ReviewEditor({ target, initialReview }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const bodyId = useId();
  const [review, setReview] = useState(initialReview);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string>();
  const save = useMutation(trpc.reviews.save.mutationOptions());
  const remove = useMutation(trpc.reviews.remove.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const visibility = form.get("visibility");
    const next: Review = {
      body: String(form.get("body")).trim(),
      visibility: isVisibility(visibility) ? visibility : "public",
    };
    setProblem(undefined);
    try {
      await save.mutateAsync({ target, ...next });
      setReview(next);
      setEditing(false);
      router.refresh();
    } catch {
      setProblem("Your review could not be saved. Check your connection and try again.");
    }
  }

  async function deleteReview() {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setProblem(undefined);
    try {
      await remove.mutateAsync({ target });
      setReview(null);
      router.refresh();
    } catch {
      setProblem("Your review could not be deleted. Check your connection and try again.");
    }
  }

  const alert = problem && (
    <p role="alert" className="text-sm text-destructive">
      {problem}
    </p>
  );

  if (review && !editing) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-5">
        <h3 className="text-sm text-muted-foreground">
          Your review{visibilityNote(review.visibility, "visible only to you")}
        </h3>
        <p className="max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
          {review.body}
        </p>
        <div className="flex gap-6 text-sm">
          <button type="button" className={linkButton} onClick={() => setEditing(true)}>
            Edit review
          </button>
          <button type="button" className={linkButton} onClick={deleteReview}>
            Delete review
          </button>
        </div>
        {alert}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor={bodyId}>Your review</Label>
      <textarea
        id={bodyId}
        name="body"
        required
        rows={5}
        maxLength={MAX_REVIEW_LENGTH}
        defaultValue={review?.body}
        placeholder="What did you think?"
        className="block w-full rounded-md border border-input bg-card px-3 py-2 leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <VisibilitySelect
        label="Who can read this review"
        name="visibility"
        defaultValue={review?.visibility ?? "public"}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {review ? "Save changes" : "Post review"}
        </Button>
        {review && (
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
      {alert}
    </form>
  );
}

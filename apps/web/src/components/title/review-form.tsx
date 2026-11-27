"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import type { Target } from "@/lib/targets";
import { isVisibility, VISIBILITIES, VISIBILITY, type Visibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";

// Matches the limit the API enforces.
const MAX_REVIEW_LENGTH = 10_000;

type Props = {
  target: Target;
  /** The signed-in person's username, for their avatar. Null until they choose one. */
  username: string | null;
  placeholder: string;
  /** The line beside the button of a new review. */
  hint?: React.ReactNode;
  /** The review being rewritten. Without one, the form posts a new review. */
  review?: { body: string; visibility: Visibility };
  /** Leaves the form without saving, and is called once a rewritten review is saved. */
  onClose?: () => void;
};

/**
 * The box a review is written in. A new review is posted for everyone to read; rewriting one
 * is also where its author chooses who can read it.
 */
export function ReviewForm({ target, username, placeholder, hint, review, onClose }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const bodyId = useId();
  const visibilityId = useId();
  const [failed, setFailed] = useState(false);
  // Stays pending until the page shows the saved review, so the form cannot be sent twice.
  const [pending, startTransition] = useTransition();
  const save = useMutation(trpc.reviews.save.mutationOptions());
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const rewriting = review !== undefined;
  useEffect(() => {
    if (rewriting) bodyField.current?.focus();
  }, [rewriting]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body")).trim();
    const visibility = form.get("visibility");
    if (!body) return;
    setFailed(false);
    startTransition(async () => {
      try {
        await save.mutateAsync({
          target,
          body,
          visibility: isVisibility(visibility) ? visibility : undefined,
        });
      } catch {
        setFailed(true);
        return;
      }
      toast(rewriting ? "Review saved" : "Review posted");
      startTransition(() => {
        router.refresh();
        onClose?.();
      });
    });
  }

  return (
    <form className="composer" onSubmit={submit}>
      <Avatar username={username} size={40} />
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={bodyId}>
          Your review
        </label>
        <textarea
          id={bodyId}
          ref={bodyField}
          name="body"
          required
          maxLength={MAX_REVIEW_LENGTH}
          defaultValue={review?.body}
          placeholder={placeholder}
        />
        <div className="composer__bar">
          {review ? (
            <>
              <div>
                <label className="hint" htmlFor={visibilityId}>
                  Who can read this review
                </label>
                <select
                  className="select"
                  id={visibilityId}
                  name="visibility"
                  defaultValue={review.visibility}
                >
                  {VISIBILITIES.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {VISIBILITY[visibility].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
                  Save changes
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="hint">{hint}</span>
              <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
                Post review
              </button>
            </>
          )}
        </div>
        {failed && (
          <p role="alert" className="error">
            Your review could not be saved. Check your connection and try again.
          </p>
        )}
      </div>
    </form>
  );
}

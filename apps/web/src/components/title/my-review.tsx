"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MemberName } from "@/components/member-name";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { formatRating } from "@/lib/format";
import type { Target } from "@/lib/targets";
import { VISIBILITY, type Visibility, visibilityNote } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { ReviewForm } from "./review-form";

type Props = {
  target: Target;
  /** The signed-in person's username. Null until they choose one. */
  username: string | null;
  review: { body: string; visibility: Visibility; rating: number | null };
  /** The day it was posted, as the list shows it: "Yesterday", "Nov 3". */
  when: string;
  /** The prompt in the box while the review is rewritten. */
  placeholder: string;
};

/** The signed-in person's own review, first in the list, with the ways to rewrite or delete it. */
export function MyReview({ target, username, review, when, placeholder }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Stays pending until the page has dropped the review, so it cannot be deleted twice.
  const [deleting, startTransition] = useTransition();
  const remove = useMutation(trpc.reviews.remove.mutationOptions());
  const mark = VISIBILITY[review.visibility];

  // Leaving the form puts the keyboard back on the button that opened it.
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function deleteReview() {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setFailed(false);
    startTransition(async () => {
      try {
        await remove.mutateAsync({ target });
      } catch {
        setFailed(true);
        return;
      }
      toast("Review deleted");
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="review">
        <ReviewForm
          target={target}
          username={username}
          placeholder={placeholder}
          review={review}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="review review--friend">
      <h3 className="sr-only">
        Your review{visibilityNote(review.visibility, "visible only to you")}
      </h3>
      <Avatar username={username} size={40} />
      <div>
        <div className="review__who">
          <MemberName username={username} />{" "}
          <span className="chip" style={{ marginLeft: 6 }}>
            <Icon name={mark.icon} size="sm" />
            {mark.label}
          </span>
        </div>
        <div className="review__when">{when}</div>
      </div>
      <div className="review__num">
        {review.rating !== null && (
          <>
            <span className="sr-only">Rated </span>
            {formatRating(review.rating)}
            <span className="sr-only"> out of 10</span>
          </>
        )}
      </div>
      <p className="review__body">{review.body}</p>
      <div className="review__acts">
        <button
          type="button"
          ref={editButton}
          className="btn btn--sm btn--soft"
          aria-label="Edit review"
          onClick={() => setEditing(true)}
        >
          <Icon name="pencil" size="sm" />
          Edit
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          aria-label="Delete review"
          disabled={deleting}
          onClick={deleteReview}
        >
          Delete
        </button>
      </div>
      {failed && (
        <p role="alert" className="error">
          Your review could not be deleted. Check your connection and try again.
        </p>
      )}
    </li>
  );
}

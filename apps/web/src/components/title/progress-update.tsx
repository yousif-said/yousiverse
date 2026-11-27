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
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

const MEASURES = {
  pages: { label: "Page you are on", first: "Set your page", step: 1, max: 100_000 },
  hours: { label: "Hours played", first: "Set hours played", step: "any", max: 100_000 },
} as const;

type Props = {
  mediaId: string;
  /** The title's name, shown under the dialog's heading. */
  title: string;
  /** A book is measured in pages, a game in hours. */
  measure: keyof typeof MEASURES;
  /** The page or the hours recorded so far, or null when nothing is. */
  recorded: number | null;
};

/** Records how far through a book or a game the signed-in person is: one number in a dialog. */
export function ProgressUpdate({ mediaId, title, measure, recorded }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const setProgress = useMutation(trpc.library.setProgress.mutationOptions());
  const { label, first, step, max } = MEASURES[measure];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entered = String(new FormData(event.currentTarget).get("amount")).trim();
    // An empty field clears what was recorded.
    const amount = entered === "" ? null : Number(entered);
    setFailed(false);
    try {
      await setProgress.mutateAsync(
        measure === "pages"
          ? { mediaId, pagesRead: amount }
          : { mediaId, minutesPlayed: amount === null ? null : Math.round(amount * 60) },
      );
    } catch {
      setFailed(true);
      return;
    }
    setOpen(false);
    toast("Progress saved");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-label={recorded === null ? undefined : "Update your progress"}
        >
          {recorded === null ? first : "Update"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <div>
            <DialogTitle>Your progress</DialogTitle>
            <p className="sh__sub">{title}</p>
          </div>
          <div className="field">
            <label htmlFor={fieldId}>{label}</label>
            <input
              className="input"
              id={fieldId}
              name="amount"
              type="number"
              inputMode={measure === "pages" ? "numeric" : "decimal"}
              min={0}
              max={max}
              step={step}
              defaultValue={recorded ?? ""}
            />
          </div>
          {failed && (
            <p role="alert" className="error">
              Your progress could not be saved. Check your connection and try again.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="btn btn--ghost">
                Cancel
              </button>
            </DialogClose>
            <button type="submit" className="btn btn--primary" disabled={setProgress.isPending}>
              Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LIBRARY_STATUSES, type LibraryEntry, statusLabel } from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { useTRPC } from "@/trpc/client";
import { VisibilitySelect } from "./visibility-select";

type Props = { mediaId: string; type: MediaType; initialEntry: LibraryEntry | null };

/** Puts a title in the signed-in person's library, changes its status, or takes it out. */
export function LibraryControl({ mediaId, type, initialEntry }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [entry, setEntry] = useState(initialEntry);
  const [failed, setFailed] = useState(false);
  const save = useMutation(trpc.library.save.mutationOptions());
  const remove = useMutation(trpc.library.remove.mutationOptions());

  async function change(next: LibraryEntry | null) {
    const previous = entry;
    setEntry(next);
    setFailed(false);
    try {
      if (next) await save.mutateAsync({ mediaId, ...next });
      else await remove.mutateAsync({ mediaId });
      router.refresh();
    } catch {
      setEntry(previous);
      setFailed(true);
    }
  }

  return (
    <div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-3 text-sm text-muted-foreground">
          {entry ? "In your library" : "Add to your library"}
        </legend>
        {LIBRARY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={entry?.status === status}
            onClick={() => change({ status, visibility: entry?.visibility ?? "public" })}
            className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {statusLabel(status, type)}
          </button>
        ))}
      </fieldset>

      {entry && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <VisibilitySelect
            label="Who can see this in your library"
            value={entry.visibility}
            onChange={(visibility) => change({ ...entry, visibility })}
          />
          <button
            type="button"
            onClick={() => change(null)}
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Remove from library
          </button>
        </div>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Your library could not be updated. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

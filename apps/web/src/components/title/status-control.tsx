"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import {
  LIBRARY_STATUSES,
  type LibraryEntry,
  type LibraryStatus,
  STATUS_ICONS,
  statusLabel,
} from "@/lib/library";
import type { MediaType } from "@/lib/media";
import { VISIBILITIES, VISIBILITY } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";

type Entry = Pick<LibraryEntry, "status" | "visibility">;

type Props = {
  mediaId: string;
  type: MediaType;
  /** The title's name, for the confirmation. */
  title: string;
  entry: Entry | null;
};

/**
 * The status control: one click puts a title in the signed-in person's library or moves it
 * along. Once it is there, who can see it and the way to take it out sit beside it.
 */
export function StatusControl({ mediaId, type, title, entry }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  // Shows the change at once; the page's own copy takes over when it has loaded again.
  const [shown, setShown] = useOptimistic(entry);
  const [failed, setFailed] = useState(false);
  const save = useMutation(trpc.library.save.mutationOptions());
  const remove = useMutation(trpc.library.remove.mutationOptions());
  const statuses = useRef<HTMLDivElement>(null);

  function change(next: Entry | null, done: string) {
    setFailed(false);
    startTransition(async () => {
      setShown(next);
      try {
        if (next) await save.mutateAsync({ mediaId, ...next });
        else await remove.mutateAsync({ mediaId });
      } catch {
        setFailed(true);
        return;
      }
      toast(done);
      router.refresh();
    });
  }

  function setStatus(status: LibraryStatus) {
    change(
      { status, visibility: shown?.visibility ?? "public" },
      `${title}: ${statusLabel(status, type).toLowerCase()}`,
    );
  }

  function showToNext(current: Entry) {
    const next = VISIBILITIES[(VISIBILITIES.indexOf(current.visibility) + 1) % VISIBILITIES.length];
    if (!next) return;
    change({ ...current, visibility: next }, `Visible to: ${VISIBILITY[next].label.toLowerCase()}`);
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot be laid out as this strip. */}
      <div
        ref={statuses}
        className="status"
        role="group"
        aria-label={shown ? "In your library" : "Add to your library"}
      >
        {LIBRARY_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={shown?.status === status}
            onClick={() => setStatus(status)}
          >
            <Icon name={STATUS_ICONS[status]} />
            {statusLabel(status, type)}
          </button>
        ))}
      </div>
      {shown && (
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            title="Who can see this in your library"
            aria-label={`Who can see this in your library: ${VISIBILITY[shown.visibility].label}`}
            onClick={() => showToNext(shown)}
          >
            <Icon name={VISIBILITY[shown.visibility].icon} size="sm" />
            {VISIBILITY[shown.visibility].label}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label="Remove from library"
            onClick={() => {
              change(null, "Removed from your library");
              // This button is about to go; keep the keyboard on the control.
              statuses.current?.querySelector("button")?.focus();
            }}
          >
            Remove
          </button>
        </>
      )}
      {failed && (
        <p role="alert" className="error">
          Your library could not be updated. Check your connection and try again.
        </p>
      )}
    </>
  );
}

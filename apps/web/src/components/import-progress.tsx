"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { Button } from "@yousiverse/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";

type Progress = RouterOutputs["imports"]["get"]["progress"];
type Props = { importId: string; initialProgress: Progress };

/** How long to wait before asking again when a data source is busy, and how often to try. */
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 6;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Works through an import a few titles at a time for as long as the page is open, showing how
 * far along it is. Leaving the page stops it; coming back picks up where it left off.
 */
export function ImportProgress({ importId, initialProgress }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { mutateAsync } = useMutation(trpc.imports.process.mutationOptions());
  const process = useRef(mutateAsync);
  process.current = mutateAsync;

  const waiting = initialProgress.pending > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` restarts the loop on "Try again".
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;

    (async () => {
      let retries = 0;
      while (!cancelled) {
        let result: Awaited<ReturnType<typeof mutateAsync>>;
        try {
          result = await process.current({ id: importId });
        } catch {
          result = { paused: true, progress: { ...initialProgress, pending: 1 } };
        }
        if (cancelled) return;

        if (!result.paused) {
          retries = 0;
          setProgress(result.progress);
          if (result.progress.pending === 0) {
            router.refresh();
            return;
          }
        } else if (++retries > MAX_RETRIES) {
          setStalled(true);
          return;
        } else {
          await wait(RETRY_DELAY_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [importId, waiting, attempt]);

  if (progress.pending === 0) return null;
  const done = progress.total - progress.pending;
  return (
    <div className="mt-8 rounded-lg border bg-card p-5">
      <p className="font-medium" aria-live="polite">
        {stalled ? "Paused" : "Importing"}: {done.toLocaleString("en-US")} of{" "}
        {progress.total.toLocaleString("en-US")} titles done
      </p>
      <progress
        value={done}
        max={progress.total}
        aria-label="Import progress"
        className="mt-3 block h-2 w-full overflow-hidden rounded-full accent-primary"
      />
      {stalled ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p role="alert" className="text-sm text-destructive">
            The import could not reach its data source. Nothing is lost.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStalled(false);
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Keep this page open until it finishes. If you leave, come back to this page to carry on.
        </p>
      )}
    </div>
  );
}

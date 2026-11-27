"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { type ImportProgress, unmatchedCount } from "@/lib/imports";
import { useTRPC } from "@/trpc/client";

type Props = {
  importId: string;
  /** The service the import came from: "Letterboxd". */
  sourceName: string;
  initialProgress: ImportProgress;
  /** What follows the counts once the import has finished. */
  children?: React.ReactNode;
};

/** How long to wait before asking again when a data source is busy, and how often to try. */
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 6;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const count = (value: number) => value.toLocaleString("en-US");

/**
 * Works through an import a few titles at a time for as long as the page is open, with the
 * counts moving as it goes. Leaving the page stops it; coming back picks up where it left off.
 */
export function ImportRun({ importId, sourceName, initialProgress, children }: Props) {
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
        const result = await process.current({ id: importId }).catch((error: unknown) => {
          console.warn("A step of the import did not go through. It will be tried again.", error);
          return null;
        });
        if (cancelled) return;
        if (result) setProgress(result.progress);

        if (result && !result.paused) {
          retries = 0;
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

  const done = progress.total - progress.pending;
  const finished = progress.pending === 0;
  const state = finished
    ? { heading: `${sourceName} import finished`, sub: "Nothing you already had was changed." }
    : stalled
      ? {
          heading: `${sourceName} import paused`,
          sub: "What is done so far is saved. It carries on from here when you try again.",
        }
      : {
          heading: `Importing from ${sourceName}`,
          sub: "Matching runs while this page is open. Leave and come back, and it carries on.",
        };

  return (
    <section className="section" aria-labelledby="import-state">
      <div className="sh">
        <div>
          <h2 className="d3" id="import-state">
            {state.heading}
          </h2>
          <p className="sh__sub">{state.sub}</p>
        </div>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label="Titles matched"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={done}
        aria-valuetext={`${count(done)} of ${count(progress.total)} titles`}
        style={
          { "--v": (done / progress.total) * 100, height: 6, marginBottom: 22 } as CSSProperties
        }
      >
        <i />
      </div>
      <div className="counts">
        <div>
          <b>{count(progress.imported)}</b>
          <span>Added to your library</span>
        </div>
        <div>
          <b>{count(progress.already)}</b>
          <span>Already there, left as they were</span>
        </div>
        <div>
          <b>{count(unmatchedCount(progress))}</b>
          <span>Could not be matched</span>
        </div>
      </div>
      {/* Says so once, when the import ends or stops, rather than reading every count aloud. */}
      <p className="sr-only" role="status">
        {(finished || stalled) && state.heading}
      </p>
      {stalled && (
        <div className="startbar">
          <button
            type="button"
            className="btn btn--soft"
            onClick={() => {
              setStalled(false);
              setAttempt((current) => current + 1);
            }}
          >
            Try again
          </button>
          <p role="alert" className="error">
            The import could not reach its data source. Nothing is lost.
          </p>
        </div>
      )}
      {finished && children}
    </section>
  );
}

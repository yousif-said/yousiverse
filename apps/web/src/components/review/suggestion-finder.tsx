"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { pluralize } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

type Props = { uncheckedTitles: number };

/** Wikidata is slow or briefly unavailable now and then, so a failure is tried again. */
const RETRY_DELAY_MS = 3000;
/** A title that fails twice is passed over; after this many failures in a row the run stops. */
const MAX_FAILURES_IN_A_ROW = 4;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Looks titles up on Wikidata one request at a time for as long as the reviewer lets it run, so
 * no single request takes long.
 */
export function SuggestionFinder({ uncheckedTitles }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const check = useMutation(trpc.links.check.mutationOptions());
  const stopRequested = useRef(false);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(uncheckedTitles);
  const [totals, setTotals] = useState({ checked: 0, suggested: 0, unreadable: 0 });
  const [problem, setProblem] = useState<string>();

  async function run() {
    stopRequested.current = false;
    setProblem(undefined);
    setRunning(true);
    let skip = 0;
    let failures = 0;
    while (!stopRequested.current) {
      try {
        const result = await check.mutateAsync({ skip });
        failures = 0;
        setRemaining(result.remaining);
        setTotals((current) => ({
          checked: current.checked + result.checked,
          suggested: current.suggested + result.suggested,
          unreadable: current.unreadable + result.unreadable,
        }));
        if (result.checked === 0) break;
      } catch (error) {
        console.warn("Looking a title up on Wikidata failed. It will be tried again.", error);
        failures += 1;
        if (failures >= MAX_FAILURES_IN_A_ROW) {
          setProblem(
            "Wikidata is not answering. What was found so far is saved; try again in a little while.",
          );
          break;
        }
        // The same title failing twice is left for another day, so it cannot hold up the rest.
        if (failures % 2 === 0) skip += 1;
        await wait(RETRY_DELAY_MS);
      }
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="kv" style={{ padding: 0 }}>
        <div>
          <b>
            {remaining > 0
              ? `${pluralize(remaining, "title")} in the catalog ${remaining === 1 ? "is" : "are"} waiting to be looked up`
              : "Every title in the catalog has been looked up"}
          </b>
          <p aria-live="polite">
            {running && "Looking titles up… "}
            {totals.checked > 0 &&
              `Looked up ${pluralize(totals.checked, "title")} and found ${pluralize(totals.suggested, "new suggestion")}. `}
            {totals.unreadable > 0 &&
              `${pluralize(totals.unreadable, "title")} could not be read and will be tried again next month.`}
          </p>
        </div>
        {running ? (
          <button
            type="button"
            className="btn btn--soft"
            onClick={() => {
              stopRequested.current = true;
            }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={run}
            disabled={remaining === 0}
          >
            Look for suggestions
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="error mt-3">
          {problem}
        </p>
      )}
    </div>
  );
}

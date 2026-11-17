"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  type AlertKind,
  alertCondition,
  parseDollars,
  sentenceCase,
  type TitleAlerts,
} from "@/lib/alerts";
import { formatDay } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

type Props = { mediaId: string } & TitleAlerts;

const textButton =
  "rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

/** The API explains these refusals in words meant for the person; anything else is generic. */
const EXPLAINED = ["CONFLICT", "PRECONDITION_FAILED"];

/**
 * Sets and removes the signed-in person's alerts on one title: one line per kind of alert the
 * title can have.
 */
export function AlertControl({ mediaId, kinds, alerts }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const set = useMutation(trpc.alerts.set.mutationOptions());
  const remove = useMutation(trpc.alerts.remove.mutationOptions());
  const [problem, setProblem] = useState<string>();
  const busy = set.isPending || remove.isPending;

  async function run(change: () => Promise<unknown>) {
    setProblem(undefined);
    try {
      await change();
      router.refresh();
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      setProblem(
        message && EXPLAINED.includes(data?.code ?? "")
          ? message
          : "That did not go through. Check your connection and try again.",
      );
    }
  }

  function setPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetCents = parseDollars(String(new FormData(event.currentTarget).get("price")));
    if (targetCents === null) {
      setProblem("Enter a price in dollars, like 9.99.");
      return;
    }
    run(() => set.mutateAsync({ mediaId, kind: "price_at_most", targetCents }));
  }

  if (kinds.length === 0) return null;
  return (
    <div className="mt-6 rounded-lg border bg-card p-5">
      <h3 className="font-medium">Alerts</h3>
      <ul className="mt-3 space-y-3 text-sm">
        {kinds.map((kind: AlertKind) => {
          const alert = alerts.find((each) => each.kind === kind);
          if (alert) {
            return (
              <li
                key={kind}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
              >
                <span>
                  {alert.triggeredAt && alert.outcome
                    ? `${sentenceCase(alert.outcome)}, found ${formatDay(new Date(alert.triggeredAt))}.`
                    : `We will tell you when ${alertCondition(kind, alert.targetCents)}.`}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove the alert for when ${alertCondition(kind, alert.targetCents)}`}
                  className={textButton}
                  onClick={() => run(() => remove.mutateAsync({ id: alert.id }))}
                >
                  Remove
                </button>
              </li>
            );
          }
          if (kind === "price_at_most") {
            return (
              <li key={kind}>
                <form onSubmit={setPrice} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-price`}>Tell me when it costs this or less</Label>
                    <Input
                      id={`${id}-price`}
                      name="price"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="9.99"
                      required
                      className="w-32"
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={busy}>
                    Set alert
                  </Button>
                </form>
              </li>
            );
          }
          return (
            <li key={kind}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => run(() => set.mutateAsync({ mediaId, kind }))}
              >
                Tell me when {alertCondition(kind, null)}
              </Button>
            </li>
          );
        })}
      </ul>
      {problem && (
        <p role="alert" className="mt-3 max-w-[65ch] text-sm text-destructive">
          {problem}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Alerts are checked once a day and arrive by email, at most one email a day.
      </p>
    </div>
  );
}

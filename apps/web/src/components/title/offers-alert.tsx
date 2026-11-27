"use client";

import { useMutation } from "@tanstack/react-query";
import { Input } from "@yousiverse/ui/components/input";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { parseDollars } from "@/lib/alerts";
import { formatPrice } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

/** The API explains these refusals in words meant for the person; anything else is generic. */
const EXPLAINED = ["CONFLICT", "PRECONDITION_FAILED"];

const ALERT_SET = "Alert set. You will hear about it once.";
const PRICE_ALERT_SET = "Price alert set. You will hear about it once.";

/**
 * Sets and removes the signed-in person's alerts on a title, and keeps what a refusal said.
 * Buttons show `busy` with `aria-disabled`, which keeps focus where it is, so a change asked
 * for while another is under way is ignored here.
 */
function useAlerts() {
  const trpc = useTRPC();
  const router = useRouter();
  const set = useMutation(trpc.alerts.set.mutationOptions());
  const remove = useMutation(trpc.alerts.remove.mutationOptions());
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<string>();
  const busy = set.isPending || remove.isPending || refreshing;

  async function run(change: () => Promise<unknown>, done: string): Promise<boolean> {
    if (busy) return false;
    setProblem(undefined);
    try {
      await change();
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      setProblem(
        message && EXPLAINED.includes(data?.code ?? "")
          ? message
          : "That did not go through. Check your connection and try again.",
      );
      return false;
    }
    toast(done);
    startRefresh(() => router.refresh());
    return true;
  }

  return {
    busy,
    problem,
    setProblem,
    set: (alert: Parameters<typeof set.mutateAsync>[0], done: string) =>
      run(() => set.mutateAsync(alert), done),
    remove: (id: string, done: string) => run(() => remove.mutateAsync({ id }), done),
  };
}

function Problem({ children }: { children: string | undefined }) {
  if (!children) return null;
  return (
    <p role="alert" className="offers__problem">
      {children}
    </p>
  );
}

type ToggleProps = {
  mediaId: string;
  kind: "on_my_subscriptions" | "streamable";
  /** What the button offers while no alert is set: "Tell me when it's on mine". */
  label: string;
  /**
   * What it says once set, where "Alert set" alone would not say which alert: beside another
   * alert's button.
   */
  setLabel?: string;
  /** The viewer's waiting alert of this kind, when they have one. */
  alertId: string | null;
};

/** One alert about where a movie or show can be watched, set and removed with the same button. */
export function AlertToggle({ mediaId, kind, label, setLabel, alertId }: ToggleProps) {
  const alerts = useAlerts();
  const on = alertId !== null;
  const whenSet = setLabel ?? (
    <>
      Alert set<span className="sr-only">: {label}</span>
    </>
  );
  return (
    <>
      <button
        type="button"
        className={cn("btn btn--sm", on ? "btn--primary" : "btn--soft")}
        aria-pressed={on}
        aria-disabled={alerts.busy || undefined}
        onClick={() =>
          on ? alerts.remove(alertId, "Alert removed") : alerts.set({ mediaId, kind }, ALERT_SET)
        }
      >
        <Icon name="bell" size="sm" />
        {on ? whenSet : label}
      </button>
      <Problem>{alerts.problem}</Problem>
    </>
  );
}

type PriceProps = {
  mediaId: string;
  /** The viewer's waiting price alert on this game, when they have one. */
  alert: { id: string; targetCents: number } | null;
  /** A price a little under today's best, offered in one click. Null when there is none. */
  suggestedCents: number | null;
};

/**
 * A game's price alert. One click sets it a little under today's best price, and the same
 * button removes it. The button beside it opens a field for any other price.
 */
export function PriceAlert({ mediaId, alert, suggestedCents }: PriceProps) {
  const alerts = useAlerts();
  const fieldId = useId();
  const [choosing, setChoosing] = useState(false);
  // With no alert and no price to suggest, the field is the only way to set one.
  const fieldOpen = choosing || (!alert && suggestedCents === null);
  const field = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(fieldOpen);

  // Focus follows the field as it opens and closes, so the keyboard is never left behind.
  useEffect(() => {
    if (fieldOpen === wasOpen.current) return;
    wasOpen.current = fieldOpen;
    (fieldOpen ? field : chooser).current?.focus();
  }, [fieldOpen]);

  async function setAt(targetCents: number) {
    const done = await alerts.set({ mediaId, kind: "price_at_most", targetCents }, PRICE_ALERT_SET);
    if (done) setChoosing(false);
  }

  function setChosen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetCents = parseDollars(String(new FormData(event.currentTarget).get("price")));
    if (targetCents === null) alerts.setProblem("Enter a price in dollars, like 9.99.");
    else setAt(targetCents);
  }

  function cancel() {
    alerts.setProblem(undefined);
    setChoosing(false);
  }

  return (
    <>
      {fieldOpen ? (
        <form className="offers__price" onSubmit={setChosen}>
          <label htmlFor={fieldId}>Tell me when it costs this or less</label>
          <Input
            ref={field}
            id={fieldId}
            name="price"
            inputMode="decimal"
            autoComplete="off"
            placeholder="9.99"
            required
          />
          <button
            type="submit"
            className="btn btn--sm btn--primary"
            aria-disabled={alerts.busy || undefined}
          >
            Set alert
          </button>
          {choosing && (
            <button type="button" className="btn btn--sm btn--ghost" onClick={cancel}>
              Cancel
            </button>
          )}
        </form>
      ) : (
        <div className="offers__price">
          {alert ? (
            <button
              type="button"
              className="btn btn--sm btn--primary"
              aria-pressed="true"
              aria-disabled={alerts.busy || undefined}
              onClick={() => alerts.remove(alert.id, "Price alert removed")}
            >
              <Icon name="bell" size="sm" />
              Alert at {formatPrice(alert.targetCents)}
            </button>
          ) : (
            suggestedCents !== null && (
              <button
                type="button"
                className="btn btn--sm btn--soft"
                aria-pressed="false"
                aria-disabled={alerts.busy || undefined}
                onClick={() => setAt(suggestedCents)}
              >
                <Icon name="bell" size="sm" />
                Tell me at {formatPrice(suggestedCents)}
              </button>
            )
          )}
          <button
            ref={chooser}
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => setChoosing(true)}
          >
            {alert ? "Change price" : "Other price"}
          </button>
        </div>
      )}
      <Problem>{alerts.problem}</Problem>
    </>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type Service = NonNullable<RouterOutputs["subscriptions"]["services"]>[number];

/** How many services are shown before the rest are tucked behind "More services". */
const SHOWN_FIRST = 12;

type Props = { initialServices: Service[] };

/** Ticks the streaming subscriptions the signed-in person has. Each change saves by itself. */
export function SubscriptionPicker({ initialServices }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [services, setServices] = useState(initialServices);
  const [failed, setFailed] = useState(false);
  const set = useMutation(trpc.subscriptions.set.mutationOptions());

  async function change(serviceId: string, subscribed: boolean) {
    const mark = (value: boolean) =>
      setServices((current) =>
        current.map((service) =>
          service.id === serviceId ? { ...service, subscribed: value } : service,
        ),
      );
    mark(subscribed);
    setFailed(false);
    try {
      await set.mutateAsync({ serviceId, subscribed });
      router.refresh();
    } catch {
      mark(!subscribed);
      setFailed(true);
    }
  }

  const checkboxes = (group: Service[]) => (
    <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {group.map((service) => (
        <li key={service.id}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={service.subscribed}
              onChange={(event) => change(service.id, event.target.checked)}
              className="size-4 shrink-0 accent-primary"
            />
            {service.name}
          </label>
        </li>
      ))}
    </ul>
  );

  // A service already ticked stays in view even when it is far down the list.
  const first = services.filter((service, index) => index < SHOWN_FIRST || service.subscribed);
  const rest = services.filter((service, index) => index >= SHOWN_FIRST && !service.subscribed);

  return (
    <div className="rounded-lg border bg-card p-5">
      <fieldset>
        <legend className="sr-only">Your subscriptions</legend>
        {checkboxes(first)}
        {rest.length > 0 && (
          <details className="mt-5 border-t pt-4">
            <summary className="cursor-pointer rounded-sm text-sm font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              More services
            </summary>
            <div className="mt-4">{checkboxes(rest)}</div>
          </details>
        )}
      </fieldset>
      {failed && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Your subscriptions could not be updated. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

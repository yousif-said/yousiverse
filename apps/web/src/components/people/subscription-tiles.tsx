"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ServiceMark } from "@/components/media/service-mark";
import { Icon } from "@/components/ui/icon";
import { useTRPC } from "@/trpc/client";

type Service = NonNullable<RouterOutputs["subscriptions"]["services"]>[number];

/** How many services are shown before the rest are tucked behind "More services". */
const SHOWN_FIRST = 12;

type Props = { initialServices: Service[] };

/** The streaming subscriptions the signed-in person has, as tiles to press. Each change saves by itself. */
export function SubscriptionTiles({ initialServices }: Props) {
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

  const tiles = (group: Service[]) => (
    <div className="subs">
      {group.map((service) => (
        <button
          key={service.id}
          type="button"
          className="svc"
          aria-pressed={service.subscribed}
          onClick={() => change(service.id, !service.subscribed)}
        >
          <ServiceMark name={service.name} logoUrl={service.logoUrl} />
          <span className="truncate">{service.name}</span>
          <Icon name="check" size="sm" />
        </button>
      ))}
    </div>
  );

  // A service already ticked stays in view even when it is far down the list.
  const first = services.filter((service, index) => index < SHOWN_FIRST || service.subscribed);
  const rest = services.filter((service, index) => index >= SHOWN_FIRST && !service.subscribed);

  return (
    <>
      {tiles(first)}
      {rest.length > 0 && (
        <details className="disclose">
          <summary>
            <Icon name="chev-r" size="sm" />
            More services
          </summary>
          {tiles(rest)}
        </details>
      )}
      {failed && (
        <p role="alert" className="error">
          Your subscriptions could not be updated. Check your connection and try again.
        </p>
      )}
    </>
  );
}

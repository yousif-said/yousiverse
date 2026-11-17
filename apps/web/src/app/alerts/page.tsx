import type { RouterOutputs } from "@yousiverse/api";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertEmailsToggle, RemoveAlertButton } from "@/components/alert-settings";
import { alertCondition, sentenceCase } from "@/lib/alerts";
import { formatDay } from "@/lib/format";
import { MEDIA, mediaPath } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Alerts" };

type Alert = RouterOutputs["alerts"]["mine"]["alerts"][number];

const sectionHeading = "font-display text-2xl font-bold tracking-tight";
const titleLink =
  "rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="mt-4 divide-y border-y">
      {alerts.map((alert) => {
        const waitingFor = alertCondition(alert.kind, alert.targetCents);
        return (
          <li
            key={alert.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
          >
            <div>
              <Link
                href={mediaPath(alert.title.type, alert.title.providerId)}
                className={titleLink}
              >
                {alert.title.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {" "}
                {MEDIA[alert.title.type].singular}
                {alert.title.releaseYear && `, ${alert.title.releaseYear}`}
              </span>
              <p className="text-sm text-muted-foreground">
                {alert.triggeredAt && alert.outcome
                  ? `${sentenceCase(alert.outcome)}, found ${formatDay(new Date(alert.triggeredAt))}`
                  : `Waiting until ${waitingFor}`}
              </p>
            </div>
            <RemoveAlertButton
              alertId={alert.id}
              label={`Remove the alert on ${alert.title.title} for when ${waitingFor}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

export default async function AlertsPage() {
  await requireSession("/alerts");
  const { alerts, emails } = await getQueryClient().fetchQuery(trpc.alerts.mine.queryOptions());
  const cameThrough = alerts.filter((alert) => alert.triggeredAt);
  const waiting = alerts.filter((alert) => !alert.triggeredAt);

  return (
    <div className="max-w-3xl pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Alerts</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        Be told when a movie or show reaches a service you can watch it on, or when a game drops to
        a price you name. Set an alert from a title&apos;s page, under where to watch or buy it.
      </p>
      <div className="mt-6">
        <AlertEmailsToggle enabled={emails} />
        <p className="mt-2 text-sm text-muted-foreground">
          Alerts are checked once a day. You get one email at most on a day something comes through;
          with emails off, look here instead.
        </p>
      </div>

      {alerts.length === 0 && (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          You have no alerts yet.{" "}
          <Link
            href="/search"
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Find a title
          </Link>{" "}
          and set one from its page.
        </p>
      )}
      {cameThrough.length > 0 && (
        <section aria-labelledby="came-through-heading" className="mt-12">
          <h2 id="came-through-heading" className={sectionHeading}>
            Came through
          </h2>
          <AlertList alerts={cameThrough} />
        </section>
      )}
      {waiting.length > 0 && (
        <section aria-labelledby="waiting-heading" className="mt-12">
          <h2 id="waiting-heading" className={sectionHeading}>
            Still waiting
          </h2>
          <AlertList alerts={waiting} />
        </section>
      )}
    </div>
  );
}

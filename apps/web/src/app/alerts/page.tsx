import type { Metadata } from "next";
import Link from "next/link";
import { type CSSProperties, Suspense } from "react";
import { AlertEmailsSwitch } from "@/components/alerts/alert-emails-switch";
import { CameCard } from "@/components/alerts/came-card";
import { WaitingRow } from "@/components/alerts/waiting-row";
import { AlertsSkeleton } from "@/components/states/page-skeletons";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHead } from "@/components/ui/section-head";
import { pluralize } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const { user } = await requireSession("/alerts");
  return (
    <Suspense fallback={<AlertsSkeleton />}>
      <Alerts email={user.email} />
    </Suspense>
  );
}

async function Alerts({ email }: { email: string }) {
  const queryClient = getQueryClient();
  const [{ alerts, emails, limit, checkedPerDay }, subscriptions] = await Promise.all([
    queryClient.fetchQuery(trpc.alerts.mine.queryOptions()),
    queryClient.fetchQuery(trpc.subscriptions.mine.queryOptions()),
  ]);
  const cameThrough = alerts.flatMap((alert) =>
    alert.triggeredAt ? { ...alert, triggeredAt: new Date(alert.triggeredAt) } : [],
  );
  const waiting = alerts.filter((alert) => !alert.triggeredAt);
  const services = subscriptions.map((service) => service.name);

  return (
    <div className="page">
      <PageHeader
        title="Alerts"
        lede="Checked every morning. Each alert tells you once, then stays here until you remove it or set it again."
      />
      <div className="split">
        <div>
          {alerts.length === 0 && (
            <div className="empty">
              <p>You have no alerts yet.</p>
              <p className="hint mt-2">
                Ask to be told when a movie or show reaches a service you can watch it on, or when a
                game drops to a price you name. Set one from any movie, show, or game page.
              </p>
              <Link className="btn btn--soft btn--sm mt-4" href="/search">
                <Icon name="search" size="sm" />
                Find a title
              </Link>
            </div>
          )}
          {cameThrough.length > 0 && (
            <section aria-labelledby="came-through-heading">
              <SectionHead
                title="Came through"
                sub={pluralize(cameThrough.length, "alert")}
                id="came-through-heading"
              />
              <div className="camegrid">
                {cameThrough.map((alert) => (
                  <CameCard key={alert.id} alert={alert} removable />
                ))}
              </div>
            </section>
          )}
          {waiting.length > 0 && (
            <section
              className={cameThrough.length > 0 ? "section" : undefined}
              aria-labelledby="waiting-heading"
            >
              <SectionHead
                title="Still waiting"
                sub={pluralize(waiting.length, "alert")}
                id="waiting-heading"
              />
              <ul>
                {waiting.map((alert) => (
                  <WaitingRow key={alert.id} alert={alert} subscriptions={services} />
                ))}
              </ul>
            </section>
          )}
          {alerts.length > 0 && (
            <p className="hint" style={{ marginTop: 16 }}>
              Set an alert from any movie, show, or game page.
            </p>
          )}
        </div>
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="panel">
            <div className="kv" style={{ padding: 0 }}>
              <div>
                <b>Email me</b>
                <p>
                  One email a morning with everything that came through, to{" "}
                  <span className="wrap-anywhere">{email}</span>.
                </p>
              </div>
              <AlertEmailsSwitch enabled={emails} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">
              <h2 className="label">Alerts in use</h2>
              <span className="mono hint">
                {alerts.length} of {limit}
              </span>
            </div>
            <div className="bar" style={{ "--v": (alerts.length / limit) * 100 } as CSSProperties}>
              <i />
            </div>
          </div>
          <div className="note">
            <Icon name="clock" />
            <span>
              Availability is checked for up to {checkedPerDay} movies and shows a day, the longest
              unchecked first. With more than that waiting, each is checked less often.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

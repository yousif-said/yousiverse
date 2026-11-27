import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import Link from "next/link";
import { Suspense } from "react";
import { ServiceMark } from "@/components/media/service-mark";
import { Icon } from "@/components/ui/icon";
import { agoLabel, dayOf, midSentence, usToday } from "@/lib/days";
import { formatPrice } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { ComingOut, NewTab, OffersLoading, OffersNote, OUTBOUND } from "./offers";
import { AlertToggle } from "./offers-alert";
import { SignInButton } from "./offers-sign-in";

type Props = {
  title: { mediaId: string; type: "movie" | "tv"; title: string; releaseDate: string | null };
};

type Offer = NonNullable<RouterOutputs["availability"]["streaming"]["offers"]>[number];
type StreamingAlert = "on_my_subscriptions" | "streamable";

const ALERT_LABELS: Record<StreamingAlert, string> = {
  on_my_subscriptions: "Tell me when it's on mine",
  streamable: "Tell me when it can be streamed",
};

const listed = new Intl.ListFormat("en-US", { type: "conjunction" });
const namesOf = (offers: Offer[]) => listed.format(offers.map((offer) => offer.service));

function Tile({ offer }: { offer: Offer }) {
  return (
    <a className={cn("svc", offer.included && "svc--mine")} href={offer.url} {...OUTBOUND}>
      <ServiceMark name={offer.service} logoUrl={offer.logoUrl} />
      {offer.service}
      {offer.priceCents !== null && <span className="mono">{formatPrice(offer.priceCents)}</span>}
      <NewTab />
    </a>
  );
}

async function Offers({ title }: Props) {
  const queryClient = getQueryClient();
  const { mediaId } = title;
  const isShow = title.type === "tv";
  const session = await getSession();
  // Nothing streams a title before it is out, so its offers are not asked for until then.
  const comingOn = title.releaseDate && title.releaseDate > usToday() ? title.releaseDate : null;
  const [alerts, availability] = await Promise.all([
    session ? queryClient.fetchQuery(trpc.alerts.forTitle.queryOptions({ mediaId })) : null,
    comingOn ? null : queryClient.fetchQuery(trpc.availability.streaming.queryOptions({ mediaId })),
  ]);

  /** The button for one kind of alert, pressed while the viewer has that alert waiting. */
  const alertToggle = (kind: StreamingAlert, setLabel?: string) => {
    // An alert that already came through is done; it is on the alerts page, not here.
    const waiting = alerts?.alerts.find((alert) => alert.kind === kind && !alert.triggeredAt);
    return (
      <AlertToggle
        mediaId={mediaId}
        kind={kind}
        label={ALERT_LABELS[kind]}
        setLabel={setLabel}
        alertId={waiting?.id ?? null}
      />
    );
  };

  if (comingOn) {
    return (
      <ComingOut
        label={isShow ? "Premieres" : "In theaters"}
        date={comingOn}
        note="Streaming details appear once it is out."
        action={
          session ? alertToggle("streamable") : <SignInButton>Sign in to set an alert</SignInButton>
        }
      />
    );
  }
  if (!availability?.offers) {
    return (
      <OffersNote>
        Where to watch this could not be checked right now. Try again in a little while.
      </OffersNote>
    );
  }

  const { offers } = availability;
  const ofKind = (kind: Offer["kind"]) => offers.filter((offer) => offer.kind === kind);
  const [lead, ...alsoMine] = offers.filter((offer) => offer.included);
  const elsewhere = ofKind("subscription").filter((offer) => !offer.included);
  const hasSubscriptions = (availability.subscriptionCount ?? 0) > 0;
  const canBeStreamed = offers.some(
    (offer) => offer.kind === "subscription" || offer.kind === "free",
  );
  const rows = [
    { label: "Subscription", offers: [...alsoMine, ...elsewhere] },
    { label: "Free with ads", offers: ofKind("free") },
    { label: "With a TV provider", offers: ofKind("tv_provider") },
    { label: isShow ? "Rent an episode" : "Rent", offers: ofKind("rent") },
    { label: isShow ? "Buy an episode" : "Buy", offers: ofKind("buy") },
  ].filter((row) => row.offers.length > 0);

  const leadAction = !session ? (
    <SignInButton>Sign in to see what's on yours</SignInButton>
  ) : hasSubscriptions ? (
    alertToggle("on_my_subscriptions")
  ) : canBeStreamed ? (
    <Link className="btn btn--sm btn--soft" href="/account">
      Tick your subscriptions
    </Link>
  ) : (
    alertToggle("streamable")
  );
  // The lead holds one action. When that is the alert about the viewer's own services and
  // nothing streams the title at all, the wider alert goes in the footer.
  const alsoStreamable = session !== null && hasSubscriptions && !lead && !canBeStreamed;
  // "Tick your subscriptions" in the lead already goes to the account page.
  const accountLinked = session !== null && (hasSubscriptions || !canBeStreamed);
  const accountLink = (
    <Link className="link" href="/account">
      Your subscriptions
    </Link>
  );
  const checked = midSentence(agoLabel(dayOf(new Date(availability.checkedAt))));

  return (
    <div className="offers">
      {lead ? (
        <div className="offers__now">
          <div>
            <span className="label">Included with your subscriptions</span>
            <div className="d3" style={{ marginTop: 6 }}>
              {namesOf([lead, ...alsoMine])}
            </div>
          </div>
          <a className="btn btn--tone btn--lg" href={lead.url} {...OUTBOUND}>
            <Icon name="play" />
            Watch on {lead.service}
            <NewTab />
          </a>
        </div>
      ) : (
        <div className="offers__now" style={{ background: "none" }}>
          <div>
            <span className="label">
              {hasSubscriptions ? "Not on your subscriptions" : "Streaming"}
            </span>
            <p style={{ fontSize: 15, color: "var(--fg)", marginTop: 6 }}>
              {offers.length === 0
                ? "Not available to stream, rent, or buy in the US right now."
                : elsewhere.length > 0
                  ? `Streaming on ${namesOf(elsewhere)}.`
                  : "Not streaming on a subscription right now."}
            </p>
          </div>
          {leadAction}
        </div>
      )}

      {rows.length > 0 && (
        <dl>
          {rows.map((row) => (
            <div key={row.label} className="offers__row">
              <dt>{row.label}</dt>
              <dd>
                {row.offers.map((offer) => (
                  <Tile key={offer.id} offer={offer} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="offers__foot">
        <span>
          US only{isShow && ", and prices are for one episode"}. Checked {checked}
          {availability.outOfDate && ", and it could not be checked again just now"}.
        </span>
        {alsoStreamable ? (
          <div className="offers__more">
            {alertToggle("streamable", "Alert set for streaming anywhere")}
            {accountLink}
          </div>
        ) : (
          accountLinked && accountLink
        )}
      </div>
    </div>
  );
}

/** Where a movie or show can be watched, the viewer's own services first, with its alerts. */
export async function WhereToWatch({ title }: Props) {
  return (
    <Suspense fallback={<OffersLoading>Checking where to watch…</OffersLoading>}>
      <Offers title={title} />
    </Suspense>
  );
}

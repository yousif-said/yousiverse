import { Suspense } from "react";
import { ServiceMark } from "@/components/media/service-mark";
import { Icon } from "@/components/ui/icon";
import { usToday } from "@/lib/days";
import { formatDay, formatPrice } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { ComingOut, NewTab, OffersLoading, OffersNote, OUTBOUND } from "./offers";
import { PriceAlert } from "./offers-alert";
import { suggestedTarget } from "./offers-prices";
import { PriceBar } from "./price-bar";

type Props = {
  title: { mediaId: string; title: string; releaseDate: string | null };
};

async function Prices({ title }: Props) {
  const queryClient = getQueryClient();
  const [session, prices] = await Promise.all([
    getSession(),
    queryClient.fetchQuery(trpc.availability.gamePrices.queryOptions({ mediaId: title.mediaId })),
  ]);

  const [best] = prices.deals ?? [];
  if (!best && title.releaseDate && title.releaseDate > usToday()) {
    return (
      <ComingOut label="Out" date={title.releaseDate} note="Store prices appear at release." />
    );
  }
  if (!prices.deals) {
    return (
      <OffersNote>Prices could not be checked right now. Try again in a little while.</OffersNote>
    );
  }
  if (!best) {
    return (
      <OffersNote>
        {prices.onSteam
          ? "No PC store has a price for this game right now. Console prices are not covered yet."
          : "No PC store sells this game, so there are no prices to show. Console prices are not covered yet."}
      </OffersNote>
    );
  }

  const alerts = session
    ? await queryClient.fetchQuery(trpc.alerts.forTitle.queryOptions({ mediaId: title.mediaId }))
    : null;
  // An alert that already came through is done; it is on the alerts page, not here.
  const waiting = alerts?.alerts.find(
    (alert) => alert.kind === "price_at_most" && !alert.triggeredAt,
  );
  const target = waiting?.targetCents ?? null;

  const off =
    best.regularPriceCents > 0
      ? Math.round((1 - best.priceCents / best.regularPriceCents) * 100)
      : 0;
  const onSaleSomewhere = prices.deals.some((deal) => deal.priceCents < deal.regularPriceCents);
  const usual = Math.max(...prices.deals.map((deal) => deal.regularPriceCents));
  const standing = [
    off > 0
      ? `${off}% off the usual ${formatPrice(best.regularPriceCents)}.`
      : !onSaleSomewhere && "Full price everywhere today.",
    prices.lowestEverCents !== null &&
      `The lowest it has ever been is ${formatPrice(prices.lowestEverCents)}.`,
  ].filter(Boolean);

  return (
    <div className="offers">
      <div className="offers__now">
        <div>
          <span className="label">Cheapest right now</span>
          <div className="d3" style={{ marginTop: 6 }}>
            <span className="mono" style={{ fontFamily: "var(--display)" }}>
              {formatPrice(best.priceCents)}
            </span>{" "}
            at {best.shop}
          </div>
          {standing.length > 0 && <p>{standing.join(" ")}</p>}
        </div>
        <a className="btn btn--tone btn--lg" href={best.url} {...OUTBOUND}>
          <Icon name="ext" />
          Open {best.shop}
          <NewTab />
        </a>
      </div>

      {prices.deals.map((deal) => (
        <a key={deal.id} className="deal" href={deal.url} {...OUTBOUND}>
          <span className="svc" style={{ background: "none", paddingLeft: 0 }}>
            <ServiceMark name={deal.shop} />
            {deal.shop}
            <NewTab />
          </span>
          {deal.priceCents < deal.regularPriceCents ? (
            <span className="deal__was">
              <span className="sr-only">Usually </span>
              {formatPrice(deal.regularPriceCents)}
            </span>
          ) : (
            <span />
          )}
          <span className="deal__price">{formatPrice(deal.priceCents)}</span>
        </a>
      ))}

      <PriceBar
        nowCents={best.priceCents}
        regularCents={usual}
        lowestEverCents={prices.lowestEverCents}
        targetCents={target}
      />

      <div className="offers__foot">
        <span>
          US PC stores. Console prices are not covered yet.
          {prices.outOfDate &&
            ` These prices are from ${formatDay(new Date(prices.checkedAt))}; they could not be checked again just now.`}
        </span>
        {session && best.priceCents > 0 && (
          <PriceAlert
            mediaId={title.mediaId}
            alert={waiting && target !== null ? { id: waiting.id, targetCents: target } : null}
            suggestedCents={suggestedTarget(best.priceCents)}
          />
        )}
      </div>
    </div>
  );
}

/** What a game costs in each PC store against its lowest price ever, with its price alert. */
export async function WhereToBuy({ title }: Props) {
  return (
    <Suspense fallback={<OffersLoading>Checking prices…</OffersLoading>}>
      <Prices title={title} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { formatDay, formatPrice } from "@/lib/format";
import { getQueryClient, trpc } from "@/trpc/server";
import { TitleAlerts } from "./title-alerts";

type Props = { mediaId: string };

const NOT_COVERED = "Only PC stores are covered. Console prices are not available yet.";

async function Deals({ mediaId }: Props) {
  const prices = await getQueryClient().fetchQuery(
    trpc.availability.gamePrices.queryOptions({ mediaId }),
  );

  if (!prices.deals) {
    return (
      <p className="mt-4 text-muted-foreground">
        Prices could not be checked right now. Try again in a little while.
      </p>
    );
  }
  if (prices.deals.length === 0) {
    return <p className="mt-4 text-muted-foreground">No PC store prices found. {NOT_COVERED}</p>;
  }

  return (
    <>
      <ul className="mt-4 divide-y border-y">
        {prices.deals.map((deal) => {
          const discount = Math.round((1 - deal.priceCents / deal.regularPriceCents) * 100);
          return (
            <li key={deal.id}>
              <a
                href={deal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">
                  {deal.shop}
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  {deal.priceCents < deal.regularPriceCents && (
                    <span className="text-sm text-muted-foreground">
                      <span className="sr-only">Usually </span>
                      <s>{formatPrice(deal.regularPriceCents)}</s>, {discount}% off
                    </span>
                  )}
                  <span className="font-medium">{formatPrice(deal.priceCents)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        {prices.lowestEverCents !== null &&
          `Lowest price ever: ${formatPrice(prices.lowestEverCents)}. `}
        US prices, checked {formatDay(new Date(prices.checkedAt))}
        {prices.outOfDate && ", and they could not be checked again just now"}. {NOT_COVERED}
      </p>
    </>
  );
}

/** What a game costs in US PC stores. */
export function WhereToBuy(props: Props) {
  return (
    <section aria-labelledby="where-to-buy-heading" className="mt-16 max-w-3xl">
      <h2 id="where-to-buy-heading" className="font-display text-2xl font-bold tracking-tight">
        Where to buy
      </h2>
      <Suspense fallback={<p className="mt-4 text-muted-foreground">Checking prices…</p>}>
        <Deals {...props} />
        <TitleAlerts mediaId={props.mediaId} />
      </Suspense>
    </section>
  );
}

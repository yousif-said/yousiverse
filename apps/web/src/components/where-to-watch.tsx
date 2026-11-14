import type { RouterOutputs } from "@yousiverse/api";
import Link from "next/link";
import { Suspense } from "react";
import { formatDay, formatPrice } from "@/lib/format";
import { getQueryClient, trpc } from "@/trpc/server";

type Offer = NonNullable<RouterOutputs["availability"]["streaming"]["offers"]>[number];

const KIND_LABELS: Record<Offer["kind"], string> = {
  subscription: "Stream",
  free: "Free",
  tv_provider: "With a TV provider",
  rent: "Rent",
  buy: "Buy",
};

const KINDS = Object.keys(KIND_LABELS) as Offer["kind"][];

type Props = { mediaId: string; type: "movie" | "tv" };

async function Offers({ mediaId, type }: Props) {
  const availability = await getQueryClient().fetchQuery(
    trpc.availability.streaming.queryOptions({ mediaId }),
  );

  if (!availability.offers) {
    return (
      <p className="mt-4 text-muted-foreground">
        Where to watch this could not be checked right now. Try again in a little while.
      </p>
    );
  }
  if (availability.offers.length === 0) {
    return (
      <p className="mt-4 text-muted-foreground">
        Not available to stream, rent, or buy in the US right now.
      </p>
    );
  }

  const { offers } = availability;
  const groups = [
    { label: "Your subscriptions", offers: offers.filter((offer) => offer.included) },
    ...KINDS.map((kind) => ({
      label: KIND_LABELS[kind],
      offers: offers.filter((offer) => offer.kind === kind && !offer.included),
    })),
  ].filter((group) => group.offers.length > 0);
  return (
    <>
      <dl className="mt-4 divide-y border-y">
        {groups.map(({ label, offers }) => (
          <div key={label} className="grid gap-x-8 gap-y-3 py-4 sm:grid-cols-[9rem_1fr]">
            <dt className="pt-1.5 text-sm text-muted-foreground">{label}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {offers.map((offer) => (
                  <li key={offer.id}>
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-baseline gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                        offer.included
                          ? "border-foreground bg-foreground text-background hover:bg-foreground/85"
                          : "bg-card hover:bg-accent"
                      }`}
                    >
                      {offer.service}
                      {offer.priceCents !== null && (
                        <span className="text-muted-foreground tabular-nums">
                          {formatPrice(offer.priceCents)}
                        </span>
                      )}
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        US only{type === "tv" && ", and prices are for one episode"}. Checked{" "}
        {formatDay(new Date(availability.checkedAt))}
        {availability.outOfDate && ", and it could not be checked again just now"}. Prices and
        availability can change.
        {availability.subscriptionCount === 0 && (
          <>
            {" "}
            <Link
              href="/account"
              className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Tick your subscriptions
            </Link>{" "}
            to see what you can already watch.
          </>
        )}
      </p>
    </>
  );
}

/** Where a movie or TV show can be streamed, rented, or bought in the US. */
export function WhereToWatch(props: Props) {
  return (
    <section aria-labelledby="where-to-watch-heading" className="mt-16 max-w-3xl">
      <h2 id="where-to-watch-heading" className="font-display text-2xl font-bold tracking-tight">
        Where to watch
      </h2>
      <Suspense fallback={<p className="mt-4 text-muted-foreground">Checking where to watch…</p>}>
        <Offers {...props} />
      </Suspense>
    </section>
  );
}

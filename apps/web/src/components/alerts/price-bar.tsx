import { cn } from "cn";
import { priceBarPositions, type StoredPrice } from "@/lib/alerts";
import { formatPrice } from "@/lib/format";

type Props = {
  price: StoredPrice;
  /** The price the alert waits for, in cents. */
  targetCents: number;
};

/** A label near either end of the bar hangs inward from its mark, so it stays inside the bar. */
function anchor(position: number): string | undefined {
  if (position < 34) return "pricebar__pt--start";
  return position > 66 ? "pricebar__pt--end" : undefined;
}

/**
 * Where a game's price stands against a price alert: the lowest it has ever been, the price
 * being waited for, and today's cheapest. Today's price is a mark without words, because
 * whatever shows the bar says it in a sentence.
 */
export function PriceBar({ price, targetCents }: Props) {
  const at = priceBarPositions(price, targetCents);

  return (
    <div className="pricebar">
      <div className="pricebar__line" />
      {at.lowest !== null && price.lowestCents !== null && (
        <span className={cn("pricebar__pt", anchor(at.lowest))} style={{ left: `${at.lowest}%` }}>
          Lowest ever {formatPrice(price.lowestCents)}
        </span>
      )}
      <span
        className={cn("pricebar__pt goal", anchor(at.target))}
        style={{ left: `${at.target}%`, top: -13, flexDirection: "column-reverse" }}
      >
        Your alert {formatPrice(targetCents)}
      </span>
      <span className="pricebar__pt now" style={{ left: `${at.now}%` }} aria-hidden="true" />
    </div>
  );
}

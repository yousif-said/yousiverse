import { formatPrice } from "@/lib/format";
import { priceScale } from "./offers-prices";

type Props = {
  /** Today's best price, in cents. */
  nowCents: number;
  /** The price without any discount: the far end of the bar. */
  regularCents: number;
  /** The lowest the game has ever cost. Null when that is not known. */
  lowestEverCents: number | null;
  /** The price the viewer asked to be told about. Null when they have no alert waiting. */
  targetCents: number | null;
};

const ABOVE_THE_LINE = { top: -13, flexDirection: "column-reverse" } as const;

/**
 * Where a game's price stands between the lowest it has ever been and what it usually costs.
 * The viewer's alert takes the place of today's price, which the panel already leads with.
 */
export function PriceBar({ nowCents, regularCents, lowestEverCents, targetCents }: Props) {
  if (lowestEverCents === null && targetCents === null) return null;
  const marked = [lowestEverCents, targetCents, nowCents].filter((cents) => cents !== null);
  const scale = priceScale(marked, regularCents);
  if (!scale) return null;
  const at = (cents: number) => `${scale(cents)}%`;

  return (
    <div style={{ padding: "16px 22px 6px", borderTop: "1px solid var(--line)" }}>
      <div className="pricebar">
        <div className="pricebar__line" />
        {lowestEverCents !== null && (
          <span className="pricebar__pt" style={{ left: at(lowestEverCents) }}>
            Lowest ever {formatPrice(lowestEverCents)}
          </span>
        )}
        {targetCents !== null ? (
          <span className="pricebar__pt goal" style={{ left: at(targetCents), ...ABOVE_THE_LINE }}>
            Your alert {formatPrice(targetCents)}
          </span>
        ) : (
          <span className="pricebar__pt now" style={{ left: at(nowCents), ...ABOVE_THE_LINE }}>
            Now {formatPrice(nowCents)}
          </span>
        )}
      </div>
    </div>
  );
}

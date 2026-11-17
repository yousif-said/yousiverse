import type { Database } from "@yousiverse/db";
import { gameDeals, games } from "@yousiverse/db/schema";
import { type GamePrices, getGamePrices } from "@yousiverse/integrations/itad";
import { eq } from "drizzle-orm";
import { ensureChecked, recordCheck } from "./check";

const NO_PRICES: GamePrices = { lowestEverCents: null, deals: [] };

async function savePrices(db: Database, mediaId: string, prices: GamePrices) {
  await db.transaction(async (tx) => {
    await tx.delete(gameDeals).where(eq(gameDeals.mediaId, mediaId));
    if (prices.deals.length > 0) {
      await tx.insert(gameDeals).values(prices.deals.map((deal) => ({ mediaId, ...deal })));
    }
    await recordCheck(tx, mediaId, prices.lowestEverCents);
  });
}

/**
 * Makes sure a game's stored PC prices are at most a week old. A game that is not on Steam, or
 * that the price provider does not know, has no prices.
 */
export function ensureGamePrices(
  db: Database,
  game: { id: string; steamAppId: string | null },
  maxAgeMs?: number,
) {
  return ensureChecked(
    db,
    game.id,
    async () => {
      const prices = game.steamAppId ? await getGamePrices(game.steamAppId) : null;
      await savePrices(db, game.id, prices ?? NO_PRICES);
    },
    maxAgeMs,
  );
}

/** The game with this media id, or null when the id is not a game's. */
export async function findGame(db: Database, mediaId: string) {
  const [game] = await db
    .select({ id: games.mediaId, steamAppId: games.steamAppId })
    .from(games)
    .where(eq(games.mediaId, mediaId));
  return game ?? null;
}

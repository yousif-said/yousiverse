import type { Database } from "@yousiverse/db";
import { media, type Provider } from "@yousiverse/db/schema";
import { measureArtwork } from "@yousiverse/integrations/artwork";
import { eq } from "drizzle-orm";

/**
 * Measures a title's poster and stores its color and shape, which pages tint themselves with.
 * A page works without them, so a poster that cannot be read is logged and left for next time.
 */
export async function measurePoster(
  db: Database,
  mediaId: string,
  provider: Provider,
  posterUrl: string,
): Promise<void> {
  try {
    const measured = await measureArtwork(provider, posterUrl);
    if (!measured) return;
    await db
      .update(media)
      .set({
        artHue: measured.hue,
        artSaturation: measured.saturation,
        posterAspect: measured.aspect,
      })
      .where(eq(media.id, mediaId));
  } catch (error) {
    console.warn(`Could not measure the poster of ${mediaId}; its page will have no tint.`, error);
  }
}

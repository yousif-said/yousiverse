import type { CSSProperties } from "react";
import { hueOf } from "@/lib/hue";
import { storeGlyph } from "@/lib/store-glyphs";

type Props = {
  /** The service's or store's name: "Netflix", "Steam". */
  name: string;
  /** A streaming service's own logo, when the catalog has one. */
  logoUrl?: string | null;
};

/**
 * The small square icon of a streaming service or a game store. A streaming service shows its
 * own logo; a store shows its brand glyph; anything unknown shows its initial on its own color.
 * Decorative: the name is always written beside it.
 */
export function ServiceMark({ name, logoUrl }: Props) {
  if (logoUrl) {
    return (
      <span className="svc__mark svc__mark--logo" aria-hidden="true">
        {/* biome-ignore lint/performance/noImgElement: a 100px logo from the provider's CDN; Next's optimizer would only add cost. */}
        <img src={logoUrl} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }

  const glyph = storeGlyph(name);
  if (glyph) {
    return (
      <span className="svc__mark" aria-hidden="true" style={{ background: glyph.color }}>
        <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d={glyph.path} />
        </svg>
      </span>
    );
  }

  return (
    <span className="svc__mark" aria-hidden="true" style={{ "--h": hueOf(name) } as CSSProperties}>
      {name
        .replace(/^the\s+/i, "")
        .slice(0, 1)
        .toUpperCase()}
    </span>
  );
}

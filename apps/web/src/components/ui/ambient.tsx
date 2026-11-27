import { imageAt } from "@yousiverse/integrations/images";

/**
 * A page's light: its lead artwork, blurred, glowing down from the top. Render it as a direct
 * child of the page (a sibling of `.page`), never inside an element that moves or transforms.
 */
export function Ambient({ src }: { src: string | null | undefined }) {
  if (!src) return null;
  return (
    <div className="ambient" aria-hidden="true">
      <div
        className="ambient__img"
        style={{ backgroundImage: `url("${imageAt(src, "small")}")` }}
      />
    </div>
  );
}

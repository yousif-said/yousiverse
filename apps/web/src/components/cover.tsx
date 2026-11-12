import { cn } from "cn";
import { MEDIA, type MediaType } from "@/lib/media";

type Props = {
  type: MediaType;
  title: string;
  posterUrl: string | null;
  /** Load immediately instead of lazily; for the one cover at the top of a page. */
  priority?: boolean;
  className?: string;
};

/**
 * A title as an object off the shelf: its artwork, with the spine in its medium's color
 * showing down the left edge.
 */
export function Cover({ type, title, posterUrl, priority = false, className }: Props) {
  // Decorative: wherever a cover appears, the title and medium are also written next to it.
  return (
    <div
      aria-hidden="true"
      className={cn("flex aspect-[5/7] overflow-hidden rounded-[3px] bg-muted", className)}
    >
      <div
        className={cn(
          "flex w-[7%] min-w-3 shrink-0 items-center justify-center overflow-hidden",
          MEDIA[type].color,
        )}
      >
        <span className="whitespace-nowrap font-display text-[0.625rem] leading-none font-bold font-stretch-condensed [writing-mode:vertical-rl]">
          {MEDIA[type].singular}
        </span>
      </div>
      {posterUrl ? (
        // biome-ignore lint/performance/noImgElement: provider CDNs already serve sized images, so Next's optimizer would only add cost.
        <img
          src={posterUrl}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="min-w-0 flex-1 object-cover"
        />
      ) : (
        <div className="flex min-w-0 flex-1 items-end p-3">
          <span className="line-clamp-4 font-display text-sm leading-tight font-bold text-muted-foreground">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}

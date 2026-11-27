import { type ImageSize, imageAt } from "@yousiverse/integrations/images";
import { cn } from "cn";
import { type CSSProperties, ViewTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { type LibraryStatus, STATUS_ICONS, statusLabel } from "@/lib/library";
import { mediaPath } from "@/lib/media";
import { glowStyle, morphName, ratioOf, type TitleArt } from "@/lib/titles";
import { ArtLink } from "./art-link";

type Props = {
  title: TitleArt;
  /** How large the image needs to be: small for thumbnails, medium for cards, large for heroes. */
  size?: ImageSize;
  /** Link to the title's page. Off for artwork on the page it would link to. */
  link?: boolean;
  /**
   * Leave the link out of the tab order and the accessibility tree, because the title is
   * written and linked right beside it. A show's card has no such text, so never set it there.
   */
  decorative?: boolean;
  /** The signed-in person's status for this title, shown as a mark in the corner. */
  status?: LibraryStatus | null;
  /** Load at once instead of lazily: for the one piece of artwork at the top of a page. */
  priority?: boolean;
  /** The poster at the top of a title's own page: the artwork clicked to get here grows into it. */
  arrives?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * A title's artwork in its medium's own shape: a movie is a poster, a show is a screen with its
 * name set over it, a game is a case, and a book is a book with a spine.
 */
export function Artwork({
  title,
  size = "medium",
  link = true,
  decorative = false,
  status,
  priority = false,
  arrives = false,
  className,
  style,
}: Props) {
  const source = title.type === "tv" ? (title.backdropUrl ?? title.posterUrl) : title.posterUrl;
  const classes = cn("art", `art--${title.type}`, !source && "art--blank", className);
  const styles = { "--ratio": ratioOf(title), ...glowStyle(title), ...style } as CSSProperties;
  const content = (
    <>
      {source && (
        // biome-ignore lint/performance/noImgElement: provider CDNs already serve sized images, so Next's optimizer would only add cost.
        <img
          src={imageAt(source, size)}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      {(title.type === "tv" || !source) && <span className="art__title">{title.title}</span>}
      {status && (
        <span className="art__check" title={statusLabel(status, title.type)}>
          <Icon name={STATUS_ICONS[status]} />
          <span className="sr-only">{statusLabel(status, title.type)}</span>
        </span>
      )}
    </>
  );

  if (!link) {
    const picture = (
      <div className={classes} style={styles}>
        {content}
      </div>
    );
    if (!arrives) return picture;
    return (
      <ViewTransition name={morphName(title)} share="morph" default="none">
        {picture}
      </ViewTransition>
    );
  }
  return (
    <ArtLink
      href={mediaPath(title.type, title.providerId)}
      morph={morphName(title)}
      className={classes}
      style={styles}
      {...(decorative ? { "aria-hidden": true, tabIndex: -1 } : { "aria-label": title.title })}
    >
      {content}
    </ArtLink>
  );
}

/** Artwork at thumbnail size, for rows and tiles. Set its height with `--art-h` where it sits. */
export function Thumb({ className, size = "small", ...props }: Props) {
  return <Artwork {...props} size={size} className={cn("thumb", className)} />;
}

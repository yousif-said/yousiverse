import { cn } from "cn";
import { Icon } from "@/components/ui/icon";
import { MEDIA, type MediaType } from "@/lib/media";

type Props = {
  type: MediaType;
  /** Show the word next to the icon. Without it the word is still there for screen readers. */
  label?: boolean;
  className?: string;
};

/** What kind of thing a title is: its medium's icon in its medium's color, and the word. */
export function Medium({ type, label = true, className }: Props) {
  return (
    <span className={cn("med", `med--${type}`, className)}>
      <Icon name={MEDIA[type].icon} size="sm" />
      {label ? MEDIA[type].one : <span className="sr-only">{MEDIA[type].one}</span>}
    </span>
  );
}

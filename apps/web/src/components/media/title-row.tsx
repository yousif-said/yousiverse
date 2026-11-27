import { cn } from "cn";
import Link from "next/link";
import { mediaPath } from "@/lib/media";
import type { TitleArt } from "@/lib/titles";
import { Thumb } from "./artwork";

type Props = {
  title: TitleArt;
  /** The line under the name: medium, year, a date, a status. */
  sub?: React.ReactNode;
  /** What sits at the far end: a score, a countdown, a button. */
  end?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "title">;

/** A title as one line in a list: thumbnail, name, a line of detail, and something at the end. */
export function TitleRow({ title, sub, end, className, ...props }: Props) {
  return (
    <div className={cn("row", className)} {...props}>
      <Thumb title={title} decorative />
      <div className="min-w-0">
        <Link className="row__title block" href={mediaPath(title.type, title.providerId)}>
          {title.title}
        </Link>
        {sub && <div className="row__sub">{sub}</div>}
      </div>
      <div className="row__end">{end}</div>
    </div>
  );
}

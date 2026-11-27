import Link from "next/link";
import { Icon } from "./icon";

type Props = {
  title: React.ReactNode;
  /** The heading's id, so the section around it can name itself with `aria-labelledby`. */
  id?: string;
  /** One line under the heading: a count, what the order is, where its contents come from. */
  sub?: React.ReactNode;
  /** A link at the far end to the rest of what the section shows a part of. */
  more?: { href: string; label: string };
  /** One action level with the heading instead: "Start a discussion". */
  action?: React.ReactNode;
};

/** The heading of one section of a page. */
export function SectionHead({ title, id, sub, more, action }: Props) {
  return (
    <div className="sh">
      <div>
        <h2 className="d3" id={id}>
          {title}
        </h2>
        {sub && <p className="sh__sub">{sub}</p>}
      </div>
      {more && (
        <Link className="sh__more" href={more.href}>
          {more.label}
          <Icon name="arrow-r" size="sm" />
        </Link>
      )}
      {action}
    </div>
  );
}

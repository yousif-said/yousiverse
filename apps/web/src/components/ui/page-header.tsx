import { cn } from "cn";
import Link from "next/link";
import { Icon } from "./icon";

type Props = {
  title: React.ReactNode;
  /** One or two sentences under the title. */
  lede?: React.ReactNode;
  /** Buttons at the far end, level with the title. */
  actions?: React.ReactNode;
  /** `page` for a place in the app (the default), `item` for one thing with a long name. */
  size?: "page" | "item";
  className?: string;
  /** Anything else under the title: a row of facts, people, chips. */
  children?: React.ReactNode;
};

/** The top of a page: its one heading, what it is for, and what you can do here. */
export function PageHeader({ title, lede, actions, size = "page", className, children }: Props) {
  return (
    <header className={cn("ph", className)}>
      <div className="ph__text">
        <h1 className={size === "page" ? "d2" : "d1"}>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children}
      </div>
      {actions && <div className="ph__actions">{actions}</div>}
    </header>
  );
}

/** The way back up from a page that belongs to another: "‹ Lists". */
export function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="crumb" href={href}>
      <Icon name="chev-l" size="sm" />
      {children}
    </Link>
  );
}

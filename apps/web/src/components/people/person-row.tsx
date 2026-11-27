import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { profilePath } from "@/lib/profile";

type Props = {
  person: { username: string; name: string };
  /** What to say under the name instead of the username: "Friends", "Runs this club". */
  note?: string;
  /** What sits at the far end: a follow button, or a mark that this is the viewer. */
  children?: React.ReactNode;
};

/** A person as one line in a list: their mark and their name, leading to their profile. */
export function PersonRow({ person, note, children }: Props) {
  const href = profilePath(person.username);
  return (
    <li className="person">
      {/* The name beside it is the link to tab to; the mark is only a bigger thing to click. */}
      <Link href={href} aria-hidden="true" tabIndex={-1}>
        <Avatar username={person.username} size={40} />
      </Link>
      <Link href={href}>
        <b>{person.name}</b> <span>{note ?? `@${person.username}`}</span>
      </Link>
      {children}
    </li>
  );
}

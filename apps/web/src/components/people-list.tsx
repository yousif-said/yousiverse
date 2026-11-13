import Link from "next/link";
import { pluralize } from "@/lib/format";
import { profilePath } from "@/lib/profile";

type Props = {
  people: { username: string; name: string }[];
  /** People who cannot be named because they have not chosen a username. */
  unnamed?: number;
};

/** People, each linking to their profile. */
export function PeopleList({ people, unnamed = 0 }: Props) {
  return (
    <>
      {people.length > 0 && (
        <ul className="divide-y border-y">
          {people.map((person) => (
            <li key={person.username}>
              <Link
                href={profilePath(person.username)}
                className="flex items-baseline justify-between gap-6 px-1 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="font-medium">{person.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{person.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {unnamed > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {people.length > 0 ? "And " : ""}
          {pluralize(unnamed, "member")} without a username.
        </p>
      )}
    </>
  );
}

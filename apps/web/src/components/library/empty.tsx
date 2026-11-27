import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/** A library with nothing in it yet: the two ways to put something there. */
export function EmptyLibrary() {
  return (
    <div className="empty">
      <h2 className="d3">Your library is empty.</h2>
      <p className="mx-auto mt-2 max-w-[52ch]">
        Search for a title and pick a status on its page to add it, or bring over what you have
        already logged somewhere else.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link className="btn btn--primary" href="/search">
          <Icon name="search" />
          Search for a title
        </Link>
        <Link className="btn btn--soft" href="/import">
          <Icon name="import" />
          Import your history
        </Link>
      </div>
    </div>
  );
}

/** Filters that leave nothing to show, with the way back to everything. */
export function NothingMatches({ everythingHref }: { everythingHref: string }) {
  return (
    <div className="empty">
      <p>Nothing here matches these filters.</p>
      <div className="mt-4 flex justify-center">
        <Link className="btn btn--soft btn--sm" href={everythingHref}>
          Show everything
        </Link>
      </div>
    </div>
  );
}

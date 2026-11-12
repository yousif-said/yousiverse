import { Button } from "@yousiverse/ui/components/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-xl pt-16 sm:pt-24">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        This page isn&apos;t on the shelf
      </h1>
      <p className="mt-4 text-muted-foreground">
        The address may be mistyped, or the title may have been removed from its source.
      </p>
      <Button asChild className="mt-8">
        <Link href="/search">Search for a title</Link>
      </Button>
    </section>
  );
}

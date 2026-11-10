import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import Link from "next/link";
import { Shelf } from "@/components/shelf";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function HomePage() {
  const queryClient = getQueryClient();
  const [session] = await Promise.all([
    getSession(),
    queryClient.prefetchQuery(trpc.media.shelf.queryOptions()),
  ]);

  return (
    <>
      <section className="pt-14 pb-12 sm:pt-24 sm:pb-16">
        <h1 className="max-w-4xl text-balance font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
          Everything you watch, play, and read on one shelf.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Yousiverse keeps your movies, shows, games, and books together, so you can rate them,
          review them, and find what&apos;s next.
        </p>
        {!session && (
          <Button asChild size="lg" className="mt-8">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </section>

      <section aria-labelledby="shelf-heading">
        <h2 id="shelf-heading" className="sr-only">
          Sample shelf
        </h2>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Shelf />
        </HydrationBoundary>
        <p className="mt-6 text-sm text-muted-foreground">
          These are sample titles. Your own library comes next.
        </p>
      </section>
    </>
  );
}

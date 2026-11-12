import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Shelf } from "@/components/shelf";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function HomePage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.media.shelf.queryOptions());

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
        <search>
          <form action="/search" className="mt-8 flex max-w-xl gap-2">
            <label htmlFor="home-search" className="sr-only">
              Search the catalog
            </label>
            <Input
              id="home-search"
              name="q"
              type="search"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="Search by title"
              className="h-12 rounded-lg bg-card px-4 text-base shadow-none md:text-base"
            />
            <Button type="submit" size="lg" className="h-12">
              Search
            </Button>
          </form>
        </search>
      </section>

      <section aria-labelledby="shelf-heading">
        <h2 id="shelf-heading" className="mb-2 font-display text-2xl font-bold tracking-tight">
          Recently added
        </h2>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Shelf />
        </HydrationBoundary>
      </section>
    </>
  );
}

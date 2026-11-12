"use client";

import { Input } from "@yousiverse/ui/components/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const DEBOUNCE_MS = 300;

/** Searches as you type by keeping the query in the URL; submits as a plain form without JS. */
export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(query: string, delay: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = query.trim();
      startTransition(() => {
        router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
      });
    }, delay);
  }

  return (
    <search>
      <form
        action="/search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          search(String(new FormData(event.currentTarget).get("q") ?? ""), 0);
        }}
      >
        <label htmlFor="search-query" className="sr-only">
          Search the catalog
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="search-query"
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder="Movies, TV shows, and games"
          autoComplete="off"
          autoFocus
          maxLength={100}
          aria-busy={isPending}
          onChange={(event) => search(event.currentTarget.value, DEBOUNCE_MS)}
          className="h-14 rounded-lg bg-card pr-4 pl-12 text-lg shadow-none md:text-lg"
        />
      </form>
    </search>
  );
}

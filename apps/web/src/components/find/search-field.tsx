"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { type MediaType, searchPath } from "@/lib/media";

const DEBOUNCE_MS = 300;

type Props = { initialQuery: string; type?: MediaType };

/** Searches as you type by keeping the query in the address; submits as a plain form without JS. */
export function SearchField({ initialQuery, type }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(query: string, delay: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        router.replace(searchPath(query.trim(), type));
      });
    }, delay);
  }

  return (
    <search>
      <form
        action="/search"
        onSubmit={(event) => {
          event.preventDefault();
          search(String(new FormData(event.currentTarget).get("q") ?? ""), 0);
        }}
      >
        {type && <input type="hidden" name="type" value={type} />}
        <label htmlFor="search-q" className="sr-only">
          Search the catalog
        </label>
        <div className="pal__in searchbar">
          <Icon name="search" size="lg" />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={initialQuery}
            placeholder="Movies, shows, games, books, and people"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: the page is for one thing, typing a search.
            autoFocus
            maxLength={100}
            aria-busy={isPending}
            onChange={(event) => search(event.currentTarget.value, DEBOUNCE_MS)}
          />
        </div>
      </form>
    </search>
  );
}

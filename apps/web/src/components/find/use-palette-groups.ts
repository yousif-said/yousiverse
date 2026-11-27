"use client";

import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usToday } from "@/lib/days";
import { useTRPC } from "@/trpc/client";
import { type PaletteGroup, paletteGroups } from "./palette-items";

/** Titles and people are searched from this many characters on. */
const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

/** The value as it was once it had stopped changing for a moment. */
function useSettled<Value>(value: Value, delayMs: number): Value {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * What the palette lists for the text typed so far. Titles and people are asked of the API once
 * typing pauses; youniverses, the person's lists and clubs, and the places in the app are
 * matched by name as each letter is typed.
 */
export function usePaletteGroups(typed: string, signedIn: boolean): PaletteGroup[] {
  const trpc = useTRPC();
  const query = typed.trim();
  const settled = useSettled(query, DEBOUNCE_MS);
  const searching = query.length >= MIN_SEARCH_LENGTH && settled.length >= MIN_SEARCH_LENGTH;
  // Results of the last search stay up while the next one loads, and a search nobody is
  // waiting for any more is cancelled.
  const whileTyping = { placeholderData: keepPreviousData, trpc: { abortOnUnmount: true } };

  const titles = useQuery(
    trpc.catalog.search.queryOptions(searching ? { query: settled } : skipToken, whileTyping),
  );
  const people = useQuery(
    trpc.profiles.search.queryOptions(
      searching ? { query: settled.slice(0, 50) } : skipToken,
      whileTyping,
    ),
  );
  const usernames = people.data?.map((person) => person.username) ?? [];
  const relations = useQuery(
    trpc.profiles.relations.queryOptions(
      signedIn && searching && usernames.length > 0 ? { usernames } : skipToken,
    ),
  );
  const universes = useQuery(trpc.links.universes.queryOptions(query ? undefined : skipToken));
  const lists = useQuery(trpc.lists.mine.queryOptions(signedIn ? undefined : skipToken));
  const clubs = useQuery(trpc.clubs.mine.queryOptions(signedIn ? undefined : skipToken));
  const underWay = useQuery(
    trpc.library.list.queryOptions(signedIn && !query ? { status: "in_progress" } : skipToken),
  );

  return paletteGroups(
    query,
    {
      // What a search found is only shown for a search: not once the text is cleared or cut short.
      titles: searching ? titles.data : undefined,
      titlesFailed: searching && titles.isError,
      people: searching ? people.data : undefined,
      following: relations.data?.following,
      universes: universes.data,
      lists: lists.data,
      clubs: clubs.data,
      underWay: underWay.data?.entries,
    },
    { signedIn, today: usToday() },
  );
}

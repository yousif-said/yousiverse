"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import { useState } from "react";
import { MEDIA, MEDIA_TYPES, type MediaType } from "@/lib/media";
import { useTRPC } from "@/trpc/client";

type ShelfItem = RouterOutputs["media"]["shelf"][number];
type Filter = MediaType | "all";

/**
 * Spine dimensions in shelf units. Each medium keeps the proportions of its real packaging:
 * slim uniform movie cases, wide TV box sets, short game cases, and books of every size.
 */
function spineSize({ type, title }: ShelfItem) {
  const variation = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  switch (type) {
    case "movie":
      return { height: 196, width: 28 };
    case "tv":
      return { height: 196, width: 50 + (variation % 3) * 9 };
    case "game":
      return { height: 172, width: 30 };
    case "book":
      return { height: 148 + (variation % 5) * 14, width: 32 + (variation % 4) * 7 };
  }
}

export function Shelf() {
  const trpc = useTRPC();
  const { data: items } = useSuspenseQuery(trpc.media.shelf.queryOptions());
  const [filter, setFilter] = useState<Filter>("all");

  if (items.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-5">
        The shelf is empty. Run <code className="font-mono text-sm">bun run db:seed</code> to add
        sample titles.
      </p>
    );
  }

  const filters = [
    { value: "all" as Filter, label: "All", color: undefined, count: items.length },
    ...MEDIA_TYPES.map((type) => ({
      value: type as Filter,
      label: MEDIA[type].label,
      color: MEDIA[type].color,
      count: items.filter((item) => item.type === type).length,
    })).filter(({ count }) => count > 0),
  ];

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="w-max min-w-full [--unit:1px] lg:[--unit:1.12px]">
          <ul className="flex items-end gap-[3px] px-2 pt-3">
            {items.map((item, index) => {
              const { height, width } = spineSize(item);
              const isSelected = filter === item.type;
              const isDimmed = filter !== "all" && !isSelected;
              return (
                <li
                  key={item.id}
                  style={{
                    height: `calc(var(--unit) * ${height})`,
                    width: `calc(var(--unit) * ${width})`,
                    animationDelay: `${index * 35}ms`,
                  }}
                  className={cn(
                    "flex shrink-0 flex-col items-center justify-between gap-2 rounded-t-[3px] py-2.5 transition-[opacity,translate] duration-300 motion-safe:animate-shelve",
                    MEDIA[item.type].color,
                    isSelected && "-translate-y-2",
                    isDimmed && "opacity-25",
                  )}
                >
                  <span className="min-h-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[calc(var(--unit)*14)] leading-none font-bold font-stretch-condensed [writing-mode:vertical-rl]">
                    {item.title}
                  </span>
                  <span className="sr-only">{MEDIA[item.type].singular}</span>
                  {item.releaseYear && (
                    <span className="text-[calc(var(--unit)*10)] leading-none opacity-70 [writing-mode:vertical-rl]">
                      {item.releaseYear}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="h-2 rounded-xs bg-foreground" />
        </div>
      </div>

      <fieldset className="mt-6 flex flex-wrap gap-2">
        <legend className="sr-only">Show on the shelf</legend>
        {filters.map(({ value, label, color, count }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {color && <span className={cn("size-2.5 rounded-[2px]", color)} />}
            {label}
            <span className="tabular-nums opacity-60">{count}</span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}

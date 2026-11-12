"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pluralize } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

type Props = { mediaId: string; initialLists: RouterOutputs["lists"]["forTitle"] };

const linkClasses =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Puts a title on the signed-in person's lists, or takes it off, one checkbox per list. */
export function ListControl({ mediaId, initialLists }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [failed, setFailed] = useState(false);
  const addItem = useMutation(trpc.lists.addItem.mutationOptions());
  const removeItem = useMutation(trpc.lists.removeItem.mutationOptions());
  const holding = lists.filter((list) => list.contains).length;

  async function toggle(listId: string, contains: boolean) {
    const setContains = (value: boolean) =>
      setLists((current) =>
        current.map((list) => (list.id === listId ? { ...list, contains: value } : list)),
      );
    setContains(contains);
    setFailed(false);
    try {
      await (contains ? addItem : removeItem).mutateAsync({ listId, mediaId });
      router.refresh();
    } catch {
      setContains(!contains);
      setFailed(true);
    }
  }

  return (
    <details className="group text-sm">
      <summary className="w-fit cursor-pointer rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Add to a list
        {holding > 0 && (
          <span className="font-normal text-muted-foreground">
            {" "}
            (on {pluralize(holding, "list")})
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-3">
        {lists.length === 0 ? (
          <p className="text-muted-foreground">You have no lists yet.</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => (
              <li key={list.id}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={list.contains}
                    onChange={(event) => toggle(list.id, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  {list.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <Link href="/lists" className={linkClasses}>
          {lists.length === 0 ? "Create a list" : "Manage lists"}
        </Link>
        {failed && (
          <p role="alert" className="text-destructive">
            The list could not be updated. Check your connection and try again.
          </p>
        )}
      </div>
    </details>
  );
}

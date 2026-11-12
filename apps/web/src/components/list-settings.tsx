"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";

type List = Pick<RouterOutputs["lists"]["get"], "id" | "name" | "description" | "visibility">;

/** For a list's owner: rename it, describe it, choose who sees it, or delete it. */
export function ListSettings({ list }: { list: List }) {
  const trpc = useTRPC();
  const router = useRouter();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [problem, setProblem] = useState<string>();
  const update = useMutation(trpc.lists.update.mutationOptions());
  const remove = useMutation(trpc.lists.remove.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProblem(undefined);
    try {
      await update.mutateAsync({
        id: list.id,
        name: String(form.get("name")),
        description: String(form.get("description")),
        visibility: form.get("private") ? "private" : "public",
      });
      if (disclosure.current) disclosure.current.open = false;
      router.refresh();
    } catch {
      setProblem("The list could not be saved. Check the name and try again.");
    }
  }

  async function deleteList() {
    if (!window.confirm(`Delete “${list.name}”? This cannot be undone.`)) return;
    setProblem(undefined);
    try {
      await remove.mutateAsync({ id: list.id });
      router.push("/lists");
      router.refresh();
    } catch {
      setProblem("The list could not be deleted. Check your connection and try again.");
    }
  }

  return (
    <details ref={disclosure} className="mt-6 max-w-xl">
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Edit list
      </summary>
      <form onSubmit={submit} className="mt-4 space-y-4 rounded-lg border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="list-name">Name</Label>
          <Input id="list-name" name="name" required maxLength={100} defaultValue={list.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="list-description">Description</Label>
          <textarea
            id="list-description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={list.description ?? ""}
            className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="private"
            defaultChecked={list.visibility === "private"}
            className="size-4 accent-primary"
          />
          Only I can see this list
        </label>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="submit" disabled={update.isPending}>
            Save changes
          </Button>
          <Button type="button" variant="ghost" className="text-destructive" onClick={deleteList}>
            Delete list
          </Button>
        </div>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </details>
  );
}

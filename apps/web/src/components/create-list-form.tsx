"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

/** Names a new list and opens it. */
export function CreateListForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const create = useMutation(trpc.lists.create.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name"));
    setFailed(false);
    try {
      const { id } = await create.mutateAsync({ name });
      router.push(`/lists/${id}`);
    } catch {
      setFailed(true);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-2">
      <Label htmlFor="new-list-name">New list</Label>
      <div className="flex gap-2">
        <Input
          id="new-list-name"
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          placeholder="Comfort rewatches"
          className="h-10 bg-card"
        />
        <Button type="submit" size="lg" disabled={create.isPending}>
          Create list
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          The list could not be created. Check the name and try again.
        </p>
      )}
    </form>
  );
}

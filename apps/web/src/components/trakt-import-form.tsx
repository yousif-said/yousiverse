"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isVisibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { VisibilitySelect } from "./visibility-select";

/** Starts an import of a public Trakt profile's watch history, ratings, and watchlist. */
export function TraktImportForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const create = useMutation(trpc.imports.createFromTrakt.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const visibility = form.get("visibility");
    setProblem(undefined);
    try {
      const { id } = await create.mutateAsync({
        profile: String(form.get("profile")),
        visibility: isVisibility(visibility) ? visibility : "public",
      });
      router.push(`/import/${id}`);
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      // The API words these for the person; anything else is not theirs to fix.
      const fixable = data?.code === "BAD_REQUEST" && message && !message.startsWith("[");
      setProblem(
        fixable ? message : "Trakt could not be reached right now. Try again in a little while.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="trakt-profile">Trakt username</Label>
        <Input
          id="trakt-profile"
          name="profile"
          required
          maxLength={200}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourname"
          aria-describedby="trakt-profile-help"
        />
        <p
          id="trakt-profile-help"
          className="max-w-[65ch] text-sm text-pretty text-muted-foreground"
        >
          Your Trakt profile has to be public while the import starts. What you watched, your
          ratings, and your watchlist come across. A show counts as finished once you have played
          every episode that has aired; until then it goes in as Watching.
        </p>
      </div>

      <VisibilitySelect
        label="Who can see the imported titles"
        name="visibility"
        defaultValue="public"
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Asking Trakt…" : "Import from Trakt"}
        </Button>
        {problem && (
          <p role="alert" className="max-w-[65ch] text-sm text-destructive">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}

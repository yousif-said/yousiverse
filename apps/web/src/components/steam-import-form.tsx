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

const PLAYED_STATUSES = [
  { value: "in_progress", label: "Playing" },
  { value: "finished", label: "Finished" },
  { value: "dropped", label: "Dropped" },
] as const;
type PlayedStatus = (typeof PLAYED_STATUSES)[number]["value"];

/** Starts an import of the games on a Steam account. */
export function SteamImportForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const create = useMutation(trpc.imports.createFromSteam.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const visibility = form.get("visibility");
    const played = PLAYED_STATUSES.find((status) => status.value === form.get("played"));
    setProblem(undefined);
    try {
      const { id } = await create.mutateAsync({
        profile: String(form.get("profile")),
        visibility: isVisibility(visibility) ? visibility : "public",
        playedStatus: (played?.value ?? "in_progress") satisfies PlayedStatus,
      });
      router.push(`/import/${id}`);
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      // The API words these for the person; anything else is not theirs to fix.
      const fixable = data?.code === "BAD_REQUEST" && message && !message.startsWith("[");
      setProblem(
        fixable ? message : "Steam could not be reached right now. Try again in a little while.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="steam-profile">Steam profile</Label>
        <Input
          id="steam-profile"
          name="profile"
          required
          minLength={2}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          placeholder="https://steamcommunity.com/id/yourname"
          aria-describedby="steam-profile-help"
        />
        <p
          id="steam-profile-help"
          className="max-w-[65ch] text-sm text-pretty text-muted-foreground"
        >
          Paste your profile's address or your 17-digit Steam ID. Your profile's Game details must
          be set to Public in Steam's privacy settings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <label htmlFor="steam-played">Games you have played go in as</label>
        <select
          id="steam-played"
          name="played"
          defaultValue="in_progress"
          className="h-9 rounded-md border border-input bg-card px-2.5 font-medium outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {PLAYED_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
      <p className="max-w-[65ch] text-sm text-pretty text-muted-foreground">
        Steam knows how long you played a game but not whether you finished it, so every played game
        gets the same status and you can correct the exceptions afterwards. Games you never started
        go in as Want to play.
      </p>

      <VisibilitySelect
        label="Who can see the imported games"
        name="visibility"
        defaultValue="public"
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Asking Steam…" : "Import from Steam"}
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

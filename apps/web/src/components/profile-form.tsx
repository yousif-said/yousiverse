"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

type Props = { initialProfile: RouterOutputs["profiles"]["me"] };

/** Chooses the username and display name that other people see. */
export function ProfileForm({ initialProfile }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "saved" | "problem"; text: string }>();
  const save = useMutation(trpc.profiles.save.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(undefined);
    try {
      await save.mutateAsync({
        username: String(form.get("username")),
        name: String(form.get("name")),
      });
      setMessage({ kind: "saved", text: "Saved." });
      router.refresh();
    } catch (error) {
      const taken = (error as { data?: { code?: string } }).data?.code === "CONFLICT";
      setMessage({
        kind: "problem",
        text: taken
          ? "That username is taken. Try another."
          : "Your profile could not be saved. Check both fields and try again.",
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={initialProfile.username ?? ""}
          aria-describedby="username-help"
        />
        <p id="username-help" className="text-sm text-muted-foreground">
          3 to 20 letters, numbers, or underscores. Your public reviews and lists are credited to
          it. Until you choose one, they show no name.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          name="name"
          required
          maxLength={50}
          autoComplete="name"
          defaultValue={initialProfile.name}
        />
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={save.isPending}>
          Save profile
        </Button>
        {message && (
          <p
            role={message.kind === "problem" ? "alert" : "status"}
            className={
              message.kind === "problem"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

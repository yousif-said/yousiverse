"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { profilePath } from "@/lib/profile";
import { useTRPC } from "@/trpc/client";

type Props = {
  initialProfile: RouterOutputs["profiles"]["me"];
  /** The site's address as the visitor reached it, for showing where their profile lives. */
  host: string | null;
};

/** Chooses the username and display name that other people see. */
export function ProfileForm({ initialProfile, host }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [problem, setProblem] = useState<string>();
  const save = useMutation(trpc.profiles.save.mutationOptions());
  const { username } = initialProfile;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProblem(undefined);
    try {
      await save.mutateAsync({
        username: String(form.get("username")),
        name: String(form.get("name")),
      });
      toast("Saved.");
      router.refresh();
    } catch (error) {
      const taken = (error as { data?: { code?: string } }).data?.code === "CONFLICT";
      setProblem(
        taken
          ? "That username is taken. Try another."
          : "Your profile could not be saved. Check both fields and try again.",
      );
    }
  }

  return (
    // The form adds no box of its own: its parts are laid out by the section around it.
    <form onSubmit={submit} className="contents">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Avatar username={username} size={72} />
        <p className="hint" style={{ maxWidth: "40ch" }}>
          Your picture is drawn from your username. Everyone gets one, and nobody has to upload
          anything.
        </p>
      </div>
      <div className="formrow">
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <Input
            id="display-name"
            name="name"
            required
            maxLength={50}
            autoComplete="name"
            defaultValue={initialProfile.name}
          />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
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
            defaultValue={username ?? ""}
            aria-describedby="username-help"
          />
          <span id="username-help" className="hint">
            3 to 20 letters, numbers, or underscores.{" "}
            {username
              ? host && (
                  <>
                    Your profile is at{" "}
                    <span className="mono wrap-anywhere">
                      {host}
                      {profilePath(username)}
                    </span>
                    .
                  </>
                )
              : "Until you choose one, your reviews and lists show no name."}
          </span>
        </div>
      </div>
      {problem && (
        <p role="alert" className="error">
          {problem}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button type="submit" disabled={save.isPending}>
          Save profile
        </Button>
        {username && (
          <Link className="btn btn--soft" href={profilePath(username)}>
            View your profile
          </Link>
        )}
      </div>
    </form>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Club } from "@/lib/clubs";
import { clubPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";
import { ClubForm } from "./club-form";

type Props = { club: Club; inviteCode: string; origin: string };

const linkButton =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** For a club's owner: the invite link, the club's details, its members, and deleting it. */
export function ClubSettings({ club, inviteCode, origin }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [code, setCode] = useState(inviteCode);
  const [note, setNote] = useState<{ kind: "done" | "problem"; text: string }>();
  const resetInvite = useMutation(trpc.clubs.resetInvite.mutationOptions());
  const removeMember = useMutation(trpc.clubs.removeMember.mutationOptions());
  const remove = useMutation(trpc.clubs.remove.mutationOptions());
  const inviteLink = `${origin}${clubPath(club.id, code)}`;
  const others = club.members.filter((member) => member.username !== club.owner);

  async function attempt(action: () => Promise<void>, failure: string) {
    setNote(undefined);
    try {
      await action();
    } catch {
      setNote({ kind: "problem", text: failure });
    }
  }

  const copyLink = () =>
    attempt(async () => {
      await navigator.clipboard.writeText(inviteLink);
      setNote({ kind: "done", text: "Link copied." });
    }, "The link could not be copied. Select it and copy it yourself.");

  const newLink = () => {
    if (!window.confirm("Make a new invite link? The current link will stop working.")) return;
    return attempt(async () => {
      const { inviteCode: next } = await resetInvite.mutateAsync({ id: club.id });
      setCode(next);
      setNote({ kind: "done", text: "New link made. The old one no longer works." });
    }, "A new link could not be made. Check your connection and try again.");
  };

  const takeOut = (username: string) => {
    if (!window.confirm(`Remove ${username} from the club?`)) return;
    return attempt(async () => {
      await removeMember.mutateAsync({ id: club.id, username });
      router.refresh();
    }, "The member could not be removed. Check your connection and try again.");
  };

  const deleteClub = () => {
    if (!window.confirm(`Delete “${club.name}” for everyone? This cannot be undone.`)) return;
    return attempt(async () => {
      await remove.mutateAsync({ id: club.id });
      router.push("/clubs");
      router.refresh();
    }, "The club could not be deleted. Check your connection and try again.");
  };

  return (
    <details ref={disclosure} className="mt-6 max-w-xl">
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Manage club
      </summary>
      <div className="mt-4 space-y-8">
        <div className="space-y-2">
          <Label htmlFor="club-invite-link">Invite link</Label>
          <div className="flex gap-2">
            <Input
              id="club-invite-link"
              readOnly
              value={inviteLink}
              onFocus={(event) => event.currentTarget.select()}
              className="bg-card"
            />
            <Button type="button" variant="outline" onClick={copyLink}>
              Copy
            </Button>
          </div>
          <p className="text-sm text-pretty text-muted-foreground">
            {club.access === "invite_only"
              ? "Anyone with this link can see the club and join it."
              : "The club is public, so anyone can join with or without this link."}{" "}
            <button type="button" className={linkButton} onClick={newLink}>
              Make a new link
            </button>
          </p>
        </div>

        <ClubForm
          club={club}
          onSaved={() => {
            if (disclosure.current) disclosure.current.open = false;
          }}
        />

        {others.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Remove a member</h3>
            <ul className="mt-2 divide-y border-y">
              {others.map((member) => (
                <li
                  key={member.username}
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <span>
                    {member.name}{" "}
                    <span className="text-sm text-muted-foreground">{member.username}</span>
                  </span>
                  <button
                    type="button"
                    className={linkButton}
                    onClick={() => takeOut(member.username)}
                  >
                    Remove<span className="sr-only"> {member.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" variant="ghost" className="text-destructive" onClick={deleteClub}>
            Delete club
          </Button>
          {note && (
            <p
              role={note.kind === "problem" ? "alert" : "status"}
              className={
                note.kind === "problem"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {note.text}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

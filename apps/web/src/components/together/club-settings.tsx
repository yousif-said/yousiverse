"use client";

import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTrigger } from "@yousiverse/ui/components/dialog";
import { Input } from "@yousiverse/ui/components/input";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import type { Club } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";
import { type ClubDetails, ClubForm } from "./club-form";

type Props = {
  club: Club;
  /** The full address that lets someone see the club and join it. */
  inviteLink: string;
};

/**
 * For a club's owner: the dialog that changes the club's details, replaces its invite link,
 * takes members out, and deletes it.
 */
export function ClubSettings({ club, inviteLink }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const inviteId = useId();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const update = useMutation(trpc.clubs.update.mutationOptions());
  const resetInvite = useMutation(trpc.clubs.resetInvite.mutationOptions());
  const removeMember = useMutation(trpc.clubs.removeMember.mutationOptions());
  const remove = useMutation(trpc.clubs.remove.mutationOptions());
  const others = club.members.filter((member) => !member.isViewer);

  async function save(details: ClubDetails) {
    await update.mutateAsync({ id: club.id, ...details });
    setOpen(false);
    toast("Club saved");
    router.refresh();
  }

  /** Runs one of the changes below the form, saying so under it if the change fails. */
  async function attempt(change: () => Promise<void>, failure: string) {
    setProblem(undefined);
    try {
      await change();
    } catch {
      setProblem(`${failure} Check your connection and try again.`);
    }
  }

  function newInviteLink() {
    if (!window.confirm("Make a new invite link? The current link will stop working.")) return;
    return attempt(async () => {
      await resetInvite.mutateAsync({ id: club.id });
      toast("New invite link made. The old one no longer works.");
      router.refresh();
    }, "A new link could not be made.");
  }

  function takeOut(username: string) {
    if (!window.confirm(`Remove ${username} from the club?`)) return;
    return attempt(async () => {
      await removeMember.mutateAsync({ id: club.id, username });
      toast(`${username} is no longer a member`);
      router.refresh();
    }, "The member could not be removed.");
  }

  function deleteClub() {
    if (!window.confirm(`Delete “${club.name}” for everyone? This cannot be undone.`)) return;
    return attempt(async () => {
      await remove.mutateAsync({ id: club.id });
      toast("Club deleted");
      router.push("/clubs");
      router.refresh();
    }, "The club could not be deleted.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setProblem(undefined);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="btn btn--soft" aria-label="Edit club">
          <Icon name="pencil" />
          Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <ClubForm heading="Edit club" club={club} submitLabel="Save changes" save={save}>
          <div className="field">
            <label htmlFor={inviteId}>Invite link</label>
            <Input
              id={inviteId}
              readOnly
              value={inviteLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <span className="hint">
              {club.access === "invite_only"
                ? "Anyone with the link can see the club and join it."
                : "The club is public, so anyone can join with or without the link."}{" "}
              A new link stops the old one working.
            </span>
            <button
              type="button"
              className="btn btn--soft btn--sm self-start"
              onClick={newInviteLink}
            >
              Make a new invite link
            </button>
          </div>
          {others.length > 0 && (
            <div className="field">
              <span>Members</span>
              <ul>
                {others.map((member) => (
                  <li key={member.username} className="person">
                    <Avatar username={member.username} size={32} />
                    <div>
                      <b>{member.name}</b> <span>@{member.username}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--soft btn--sm"
                      onClick={() => takeOut(member.username)}
                    >
                      Remove<span className="sr-only"> {member.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="field">
            <span className="hint">
              Deleting the club removes its picks and discussions for every member.
            </span>
            <button
              type="button"
              className="btn btn--soft btn--danger btn--sm self-start"
              onClick={deleteClub}
            >
              <Icon name="trash" size="sm" />
              Delete club
            </button>
          </div>
          {problem && (
            <p className="error" role="alert">
              {problem}
            </p>
          )}
        </ClubForm>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@yousiverse/ui/components/dialog";
import { Textarea } from "@yousiverse/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Item = { listId: string; mediaId: string; title: string };

/** Takes a title off a list, for the list's owner. */
export function RemoveListItemButton({ listId, mediaId, title }: Item) {
  const trpc = useTRPC();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const removeItem = useMutation(trpc.lists.removeItem.mutationOptions());

  async function remove() {
    setFailed(false);
    try {
      await removeItem.mutateAsync({ listId, mediaId });
      toast("Removed from the list");
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      {failed && (
        <span className="error" role="alert">
          Not removed. Try again.
        </span>
      )}
      <button
        type="button"
        className="iconbtn iconbtn--sm"
        onClick={remove}
        disabled={removeItem.isPending}
        aria-label={`Remove ${title} from this list`}
      >
        <Icon name="x" size="sm" />
      </button>
    </>
  );
}

type NoteFormProps = Item & { note: string | null; onSaved: () => void };

function NoteForm({ listId, mediaId, title, note, onSaved }: NoteFormProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [failed, setFailed] = useState(false);
  const setNote = useMutation(trpc.lists.setNote.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const written = String(new FormData(event.currentTarget).get("note")).trim();
    setFailed(false);
    try {
      await setNote.mutateAsync({ listId, mediaId, note: written || null });
      toast(written ? "Note saved" : "Note removed");
      router.refresh();
      onSaved();
    } catch {
      setFailed(true);
    }
  }

  return (
    <form onSubmit={submit} className="contents">
      <div>
        <DialogTitle>{note ? "Edit note" : "Add a note"}</DialogTitle>
        <p className="sh__sub">{title}</p>
      </div>
      <div className="field">
        <label htmlFor={id}>Why it is on the list</label>
        <Textarea id={id} name="note" maxLength={280} defaultValue={note ?? ""} />
        <span className="hint">
          Up to 280 characters, shown to everyone who can see the list. Leave it empty for no note.
        </span>
      </div>
      {failed && (
        <p className="error" role="alert">
          The note could not be saved. Check your connection and try again.
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className="btn btn--ghost">
            Cancel
          </button>
        </DialogClose>
        <button type="submit" className="btn btn--primary" disabled={setNote.isPending}>
          Save note
        </button>
      </DialogFooter>
    </form>
  );
}

/** For a list's owner: writes, changes, or removes the note under one of its titles. */
export function NoteEditor({ note, ...item }: Item & { note: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="hint link mt-1"
          aria-label={note ? `Edit note on ${item.title}` : `Add a note to ${item.title}`}
        >
          {note ? "Edit note" : "Add a note"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <NoteForm {...item} note={note} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

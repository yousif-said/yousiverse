"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@yousiverse/ui/components/dialog";
import { Input } from "@yousiverse/ui/components/input";
import { Textarea } from "@yousiverse/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { VISIBILITIES, VISIBILITY, type Visibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { Segmented } from "./segmented";

type List = Pick<RouterOutputs["lists"]["get"], "id" | "name" | "description" | "visibility">;

const VISIBILITY_CHOICES = VISIBILITIES.map((visibility) => ({
  value: visibility,
  ...VISIBILITY[visibility],
}));

type FormProps = {
  /** The list being edited. Left out to make a new one. */
  list?: List;
  /** Called once the list is saved, so the dialog can close. */
  onSaved: () => void;
};

function ListForm({ list, onSaved }: FormProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [visibility, setVisibility] = useState<Visibility>(list?.visibility ?? "public");
  const [problem, setProblem] = useState<string>();
  const create = useMutation(trpc.lists.create.mutationOptions());
  const update = useMutation(trpc.lists.update.mutationOptions());
  const remove = useMutation(trpc.lists.remove.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details = {
      name: String(form.get("name")),
      description: String(form.get("description")),
      visibility,
    };
    setProblem(undefined);
    try {
      if (list) {
        await update.mutateAsync({ id: list.id, ...details });
        toast("List saved");
        router.refresh();
      } else {
        const created = await create.mutateAsync(details);
        toast("List created");
        router.push(`/lists/${created.id}`);
      }
      onSaved();
    } catch {
      setProblem("The list could not be saved. Check the name and try again.");
    }
  }

  async function deleteList(listId: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setProblem(undefined);
    try {
      await remove.mutateAsync({ id: listId });
      toast("List deleted");
      router.push("/lists");
      router.refresh();
    } catch {
      setProblem("The list could not be deleted. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogTitle>{list ? "Edit list" : "New list"}</DialogTitle>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={list?.name}
          placeholder="Rainy-day rewatches"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-description`}>
          Description <span className="hint">(optional)</span>
        </label>
        <Textarea
          id={`${id}-description`}
          name="description"
          maxLength={500}
          defaultValue={list?.description ?? ""}
          style={{ minHeight: 80 }}
        />
      </div>
      <div className="field">
        <span id={`${id}-visibility`}>Who can see it</span>
        <Segmented
          labelledBy={`${id}-visibility`}
          options={VISIBILITY_CHOICES}
          value={visibility}
          onChange={setVisibility}
        />
      </div>
      {list && (
        <div className="field">
          <span className="hint">Deleting the list leaves your library as it is.</span>
          <button
            type="button"
            className="btn btn--soft btn--danger btn--sm self-start"
            onClick={() => deleteList(list.id, list.name)}
          >
            <Icon name="trash" size="sm" />
            Delete list
          </button>
        </div>
      )}
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className="btn btn--ghost">
            Cancel
          </button>
        </DialogClose>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={create.isPending || update.isPending}
        >
          {list ? "Save changes" : "Create list"}
        </button>
      </DialogFooter>
    </form>
  );
}

/**
 * The button and dialog that make a list or, given a list, change its name, its description,
 * and who can see it, or delete it.
 */
export function ListDialog({ list }: { list?: List }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {list ? (
          <button type="button" className="btn btn--soft" aria-label="Edit list">
            <Icon name="pencil" />
            Edit
          </button>
        ) : (
          <button type="button" className="btn btn--primary">
            <Icon name="plus" />
            New list
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <ListForm list={list} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

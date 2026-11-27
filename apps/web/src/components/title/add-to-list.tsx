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
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { pluralize } from "@/lib/format";
import { VISIBILITIES, VISIBILITY, type Visibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { CheckRow } from "./check-row";

type OwnList = {
  id: string;
  name: string;
  visibility: Visibility;
  itemCount: number;
  /** Whether the list holds this title. */
  contains: boolean;
};

type Props = {
  mediaId: string;
  /** The title's name, shown under the dialog's heading. */
  title: string;
  lists: OwnList[];
};

/** Puts a title on the signed-in person's lists or takes it off, and makes a new list for it. */
export function AddToList({ mediaId, title, lists: initialLists }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string>();
  const addItem = useMutation(trpc.lists.addItem.mutationOptions());
  const removeItem = useMutation(trpc.lists.removeItem.mutationOptions());

  async function toggle(listId: string, contains: boolean) {
    const show = (value: boolean) =>
      setLists((current) =>
        current.map((list) =>
          list.id === listId
            ? { ...list, contains: value, itemCount: list.itemCount + (value ? 1 : -1) }
            : list,
        ),
      );
    show(contains);
    setProblem(undefined);
    try {
      await (contains ? addItem : removeItem).mutateAsync({ listId, mediaId });
      router.refresh();
    } catch {
      show(!contains);
      setProblem("The list could not be updated. Check your connection and try again.");
    }
  }

  function created(list: OwnList) {
    setLists((current) => [...current, list].sort((a, b) => a.name.localeCompare(b.name)));
    setCreating(false);
    toast("List created");
    void toggle(list.id, true);
  }

  return (
    <Dialog
      onOpenChange={() => {
        setCreating(false);
        setProblem(undefined);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="btn btn--sm btn--soft">
          <Icon name="plus" size="sm" />
          Add to a list
        </button>
      </DialogTrigger>
      <DialogContent>
        {creating ? (
          <NewList onCreated={created} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <div>
              <DialogTitle>Add to a list</DialogTitle>
              <p className="sh__sub">{title}</p>
            </div>
            {lists.length === 0 ? (
              <p className="dim">You have no lists yet. Make the first one for this.</p>
            ) : (
              <ul className="rows">
                {lists.map((list) => (
                  <CheckRow
                    key={list.id}
                    checked={list.contains}
                    onChange={(contains) => toggle(list.id, contains)}
                    name={list.name}
                    sub={`${pluralize(list.itemCount, "title")} · ${VISIBILITY[list.visibility].label}`}
                  />
                ))}
              </ul>
            )}
            {problem && (
              <p role="alert" className="error">
                {problem}
              </p>
            )}
            <DialogFooter>
              <button type="button" className="btn btn--ghost" onClick={() => setCreating(true)}>
                <Icon name="plus" size="sm" />
                New list
              </button>
              <DialogClose asChild>
                <button type="button" className="btn btn--primary">
                  Done
                </button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type NewListProps = { onCreated: (list: OwnList) => void; onCancel: () => void };

/** The form for a new list, shown in place of the lists. The title goes on it once it exists. */
function NewList({ onCreated, onCancel }: NewListProps) {
  const trpc = useTRPC();
  const nameId = useId();
  const descriptionId = useId();
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [failed, setFailed] = useState(false);
  const create = useMutation(trpc.lists.create.mutationOptions());
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => nameField.current?.focus(), []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    setFailed(false);
    try {
      const { id } = await create.mutateAsync({
        name,
        description: String(form.get("description")),
        visibility,
      });
      onCreated({ id, name, visibility, itemCount: 0, contains: false });
    } catch {
      setFailed(true);
    }
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogTitle>New list</DialogTitle>
      <div className="field">
        <label htmlFor={nameId}>Name</label>
        <input
          className="input"
          id={nameId}
          ref={nameField}
          name="name"
          required
          maxLength={80}
          placeholder="Rainy-day rewatches"
        />
      </div>
      <div className="field">
        <label htmlFor={descriptionId}>
          Description <span className="hint">(optional)</span>
        </label>
        <textarea
          className="textarea"
          id={descriptionId}
          name="description"
          maxLength={500}
          style={{ minHeight: 80 }}
        />
      </div>
      <div className="field">
        <span>Who can see it</span>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot be laid out as this strip. */}
        <div className="seg" role="group" aria-label="Who can see it">
          {VISIBILITIES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={visibility === choice}
              onClick={() => setVisibility(choice)}
            >
              <Icon name={VISIBILITY[choice].icon} size="sm" />
              {VISIBILITY[choice].label}
            </button>
          ))}
        </div>
      </div>
      {failed && (
        <p role="alert" className="error">
          The list could not be created. Check your connection and try again.
        </p>
      )}
      <DialogFooter>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={create.isPending}>
          Create list
        </button>
      </DialogFooter>
    </form>
  );
}

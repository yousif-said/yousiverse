"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@yousiverse/ui/components/dialog";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { Textarea } from "@yousiverse/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

type Props = {
  /** Any title of the universe. */
  mediaId: string;
  /** What it goes by now: a reviewer's name for it, or its oldest title's. */
  name: string;
  description: string | null;
  /** Whether a reviewer has named it already. */
  named: boolean;
};

/** For reviewers: gives a universe its own name and a line that says what it is. */
export function NameUniverse({ mediaId, name, description, named }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = useMutation(trpc.links.nameUniverse.mutationOptions());
  const action = named ? "Edit name" : "Name this universe";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFailed(false);
    try {
      await save.mutateAsync({
        mediaId,
        name: String(form.get("name")),
        description: String(form.get("description")),
      });
      setOpen(false);
      toast("Universe named");
      router.refresh();
    } catch {
      setFailed(true);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setFailed(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Icon name="pencil" size="sm" />
          {action}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} style={{ display: "contents" }}>
          <DialogTitle>{action}</DialogTitle>
          <div className="field">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} name="name" required maxLength={80} defaultValue={name} />
          </div>
          <div className="field">
            <Label htmlFor={`${id}-description`}>
              Description <span className="hint">(optional)</span>
            </Label>
            <Textarea
              id={`${id}-description`}
              name="description"
              maxLength={300}
              defaultValue={description ?? ""}
              style={{ minHeight: 80 }}
            />
            <p className="hint">One line on what joins these titles, shown under the name.</p>
          </div>
          {failed && (
            <p role="alert" className="error">
              The name could not be saved. Try again in a little while.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

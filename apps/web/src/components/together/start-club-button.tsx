"use client";

import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTrigger } from "@yousiverse/ui/components/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { clubPath } from "@/lib/clubs";
import { useTRPC } from "@/trpc/client";
import { type ClubDetails, ClubForm } from "./club-form";

/** Opens the dialog that starts a club, then goes to the new club. */
export function StartClubButton() {
  const trpc = useTRPC();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const create = useMutation(trpc.clubs.create.mutationOptions());

  async function start(details: ClubDetails) {
    const { id } = await create.mutateAsync(details);
    setOpen(false);
    toast("Club started");
    router.push(clubPath(id));
    // The sidebar lists the person's clubs and is not redrawn by moving between pages.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn--primary">
          <Icon name="plus" />
          Start a club
        </button>
      </DialogTrigger>
      <DialogContent>
        <ClubForm heading="Start a club" submitLabel="Start club" save={start} />
      </DialogContent>
    </Dialog>
  );
}

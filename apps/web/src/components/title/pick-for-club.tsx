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
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { pluralize } from "@/lib/format";
import { MEDIA, type MediaType } from "@/lib/media";
import { useTRPC } from "@/trpc/client";
import { CheckRow } from "./check-row";

type OwnClub = {
  id: string;
  name: string;
  memberCount: number;
  /** Whether the club has picked this title. */
  picked: boolean;
};

type Props = {
  mediaId: string;
  type: MediaType;
  /** The viewer's clubs that cover this kind of title. */
  clubs: OwnClub[];
};

/** Picks a title for the signed-in person's clubs, or takes a pick back. */
export function PickForClub({ mediaId, type, clubs: initialClubs }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [clubs, setClubs] = useState(initialClubs);
  const [problem, setProblem] = useState<string>();
  const addPick = useMutation(trpc.clubs.addPick.mutationOptions());
  const removePick = useMutation(trpc.clubs.removePick.mutationOptions());

  async function toggle(clubId: string, picked: boolean) {
    const show = (value: boolean) =>
      setClubs((current) =>
        current.map((club) => (club.id === clubId ? { ...club, picked: value } : club)),
      );
    show(picked);
    setProblem(undefined);
    try {
      await (picked ? addPick : removePick).mutateAsync({ id: clubId, mediaId });
      router.refresh();
    } catch (error) {
      show(!picked);
      const { data, message } = error as { data?: { code?: string }; message?: string };
      // The API says who may take a pick back; anything else is not worth showing as it came.
      setProblem(
        data?.code === "FORBIDDEN" && message
          ? message
          : "The club could not be updated. Check your connection and try again.",
      );
    }
  }

  return (
    <Dialog onOpenChange={() => setProblem(undefined)}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn--sm btn--soft">
          <Icon name="clubs" size="sm" />
          Pick for a club
        </button>
      </DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>Pick for a club</DialogTitle>
          <p className="sh__sub">Only clubs that cover {MEDIA[type].plural} are offered.</p>
        </div>
        <ul className="rows">
          {clubs.map((club) => (
            <CheckRow
              key={club.id}
              checked={club.picked}
              onChange={(picked) => toggle(club.id, picked)}
              name={club.name}
              sub={pluralize(club.memberCount, "member")}
            />
          ))}
        </ul>
        {problem && (
          <p role="alert" className="error">
            {problem}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <button type="button" className="btn btn--primary">
              Done
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

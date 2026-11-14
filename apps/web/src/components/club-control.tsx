"use client";

import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@yousiverse/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { pluralize } from "@/lib/format";
import { useTRPC } from "@/trpc/client";

type Props = { mediaId: string; initialClubs: RouterOutputs["clubs"]["forTitle"] };

/**
 * Picks a title for the signed-in person's clubs, one checkbox per club. Only the clubs that
 * cover this kind of title are offered.
 */
export function ClubControl({ mediaId, initialClubs }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const [clubs, setClubs] = useState(initialClubs);
  const [problem, setProblem] = useState<string>();
  const addPick = useMutation(trpc.clubs.addPick.mutationOptions());
  const removePick = useMutation(trpc.clubs.removePick.mutationOptions());
  const picking = clubs.filter((club) => club.picked).length;

  async function toggle(clubId: string, picked: boolean) {
    const setPicked = (value: boolean) =>
      setClubs((current) =>
        current.map((club) => (club.id === clubId ? { ...club, picked: value } : club)),
      );
    setPicked(picked);
    setProblem(undefined);
    try {
      await (picked ? addPick : removePick).mutateAsync({ id: clubId, mediaId });
      router.refresh();
    } catch (error) {
      setPicked(!picked);
      const { data, message } = error as { data?: { code?: string }; message?: string };
      setProblem(
        data?.code === "FORBIDDEN" && message
          ? message
          : "The club could not be updated. Check your connection and try again.",
      );
    }
  }

  return (
    <details className="group text-sm">
      <summary className="w-fit cursor-pointer rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Pick for a club
        {picking > 0 && (
          <span className="font-normal text-muted-foreground">
            {" "}
            (picked by {pluralize(picking, "club")})
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-3">
        <ul className="space-y-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={club.picked}
                  onChange={(event) => toggle(club.id, event.target.checked)}
                  className="size-4 accent-primary"
                />
                {club.name}
              </label>
            </li>
          ))}
        </ul>
        {problem && (
          <p role="alert" className="text-destructive">
            {problem}
          </p>
        )}
      </div>
    </details>
  );
}

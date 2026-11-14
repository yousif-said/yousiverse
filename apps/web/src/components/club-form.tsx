"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Input } from "@yousiverse/ui/components/input";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  ACCESS_LABELS,
  CLUB_ACCESS_LEVELS,
  type Club,
  type ClubAccess,
  clubPath,
} from "@/lib/clubs";
import { isMediaType, MEDIA, MEDIA_TYPES } from "@/lib/media";
import { useTRPC } from "@/trpc/client";

type Props = {
  /** The club being edited. Left out to start a new one. */
  club?: Pick<Club, "id" | "name" | "description" | "access" | "mediaTypes">;
  onSaved?: () => void;
};

/** Starts a club or changes one: its name, what it covers, and who can join. */
export function ClubForm({ club, onSaved }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const id = useId();
  const [problem, setProblem] = useState<string>();
  const create = useMutation(trpc.clubs.create.mutationOptions());
  const update = useMutation(trpc.clubs.update.mutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mediaTypes = form.getAll("mediaTypes").filter(isMediaType);
    const access = CLUB_ACCESS_LEVELS.find((level) => level === form.get("access"));
    setProblem(undefined);
    if (mediaTypes.length === 0 || !access) {
      setProblem("Tick at least one kind of title for the club to cover.");
      return;
    }
    const details = {
      name: String(form.get("name")),
      description: String(form.get("description")),
      access,
      mediaTypes,
    };
    try {
      if (club) {
        await update.mutateAsync({ id: club.id, ...details });
        router.refresh();
        onSaved?.();
      } else {
        const created = await create.mutateAsync(details);
        router.push(clubPath(created.id));
      }
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      setProblem(
        data?.code === "PRECONDITION_FAILED" && message
          ? message
          : "The club could not be saved. Check the name and try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Club name</Label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          defaultValue={club?.name}
          placeholder="Slow Readers"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={club?.description ?? ""}
          className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">What the club covers</legend>
        <p className="mb-3 text-sm text-muted-foreground">
          The club only ever shows these kinds of titles.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {MEDIA_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="mediaTypes"
                value={type}
                defaultChecked={club?.mediaTypes.includes(type)}
                className="size-4 accent-primary"
              />
              {MEDIA[type].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Who can join</legend>
        <div className="space-y-2">
          {CLUB_ACCESS_LEVELS.map((level: ClubAccess) => (
            <label key={level} className="flex items-baseline gap-2 text-sm">
              <input
                type="radio"
                name="access"
                value={level}
                defaultChecked={(club?.access ?? "public") === level}
                className="size-4 translate-y-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">{ACCESS_LABELS[level].label}.</span>{" "}
                <span className="text-muted-foreground">{ACCESS_LABELS[level].help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {club ? "Save changes" : "Start club"}
        </Button>
        {problem && (
          <p role="alert" className="max-w-[65ch] text-sm text-destructive">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}

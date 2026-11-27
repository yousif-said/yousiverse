"use client";

import { DialogClose, DialogFooter, DialogTitle } from "@yousiverse/ui/components/dialog";
import { Input } from "@yousiverse/ui/components/input";
import { Textarea } from "@yousiverse/ui/components/textarea";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ACCESS, CLUB_ACCESS_LEVELS, type Club, type ClubAccess } from "@/lib/clubs";
import { MEDIA, MEDIA_TYPES, type MediaType } from "@/lib/media";
import { problemFrom } from "./problem";
import { Segmented } from "./segmented";

export type ClubDetails = {
  name: string;
  description: string;
  access: ClubAccess;
  mediaTypes: MediaType[];
};

type Props = {
  heading: string;
  /** The club being edited. Left out to start a new one. */
  club?: Pick<Club, "name" | "description" | "access" | "mediaTypes">;
  submitLabel: string;
  /** Stores the details. If it throws, the form says the club could not be saved. */
  save: (details: ClubDetails) => Promise<void>;
  /** More settings, between the fields and the buttons. */
  children?: React.ReactNode;
};

const ACCESS_CHOICES = CLUB_ACCESS_LEVELS.map((level) => ({
  value: level,
  label: ACCESS[level].choice,
  icon: ACCESS[level].icon,
}));

/** The inside of a dialog that starts a club or changes one: name, what it covers, who can join. */
export function ClubForm({ heading, club, submitLabel, save, children }: Props) {
  const id = useId();
  // One kind is chosen from the start, so a club can be started by typing only its name.
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(club?.mediaTypes ?? ["book"]);
  const [access, setAccess] = useState<ClubAccess>(club?.access ?? "public");
  const [problem, setProblem] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  function toggle(type: MediaType) {
    setMediaTypes((chosen) =>
      chosen.includes(type) ? chosen.filter((other) => other !== type) : [...chosen, type],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mediaTypes.length === 0) {
      setProblem("Choose at least one kind of title for the club to cover.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setProblem(undefined);
    setIsSaving(true);
    try {
      await save({
        name: String(form.get("name")),
        description: String(form.get("description")),
        access,
        mediaTypes,
      });
    } catch (error) {
      setProblem(problemFrom(error, "The club could not be saved. Check the name and try again."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogTitle>{heading}</DialogTitle>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          defaultValue={club?.name}
          placeholder="Thursday Night Noir"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-description`}>What is it about?</label>
        <Textarea
          id={`${id}-description`}
          name="description"
          maxLength={500}
          defaultValue={club?.description ?? ""}
          style={{ minHeight: 80 }}
        />
      </div>
      <div className="field">
        <span id={`${id}-covers`}>What it covers</span>
        <fieldset className="picks min-w-0" aria-labelledby={`${id}-covers`}>
          {MEDIA_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={mediaTypes.includes(type)}
              onClick={() => toggle(type)}
            >
              <span className={`c-${type}`}>
                <Icon name={MEDIA[type].icon} size="lg" />
              </span>
              {MEDIA[type].label}
            </button>
          ))}
        </fieldset>
        <span className="hint">Members can only pick these kinds of titles.</span>
      </div>
      <div className="field">
        <span id={`${id}-access`}>Who can join</span>
        <Segmented
          labelledBy={`${id}-access`}
          options={ACCESS_CHOICES}
          value={access}
          onChange={setAccess}
        />
      </div>
      {children}
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
        <button type="submit" className="btn btn--primary" disabled={isSaving}>
          {submitLabel}
        </button>
      </DialogFooter>
    </form>
  );
}

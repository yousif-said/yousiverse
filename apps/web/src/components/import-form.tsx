"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@yousiverse/ui/components/button";
import { Label } from "@yousiverse/ui/components/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FILE_SOURCES, type FileSource, SOURCE_LABELS } from "@/lib/imports";
import { isVisibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { VisibilitySelect } from "./visibility-select";

// Matches the limits the API enforces.
const MAX_FILES = 8;
const MAX_FILE_CHARACTERS = 3_000_000;

/** Uploads the files another service exported and starts an import from them. */
export function ImportForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const [source, setSource] = useState<FileSource>("letterboxd");
  const [problem, setProblem] = useState<string>();
  const create = useMutation(trpc.imports.createFromFiles.mutationOptions());
  const { help } = FILE_SOURCES.find((each) => each.source === source) ?? FILE_SOURCES[0];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosen = form.getAll("files").filter((file): file is File => file instanceof File);
    const visibility = form.get("visibility");
    setProblem(undefined);

    if (chosen.length === 0 || chosen.length > MAX_FILES) {
      setProblem(`Choose between 1 and ${MAX_FILES} files.`);
      return;
    }
    const files = await Promise.all(
      chosen.map(async (file) => ({ name: file.name, text: await file.text() })),
    );
    const tooLarge = files.find((file) => file.text.length > MAX_FILE_CHARACTERS);
    if (tooLarge) {
      setProblem(`${tooLarge.name} is too large to import. Files can be up to about 3 MB.`);
      return;
    }
    if (files.some((file) => file.text.trim() === "")) {
      setProblem("One of the files is empty. Choose the files again.");
      return;
    }

    try {
      const { id } = await create.mutateAsync({
        source,
        visibility: isVisibility(visibility) ? visibility : "public",
        files,
      });
      router.push(`/import/${id}`);
    } catch (error) {
      const { data, message } = error as { data?: { code?: string }; message?: string };
      // The API words these for the person; anything else is not theirs to fix.
      const fixable = data?.code === "BAD_REQUEST" && message && !message.startsWith("[");
      setProblem(
        fixable ? message : "The import could not be started. Check the files and try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-5">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Import from</legend>
        <div className="flex flex-wrap gap-2">
          {FILE_SOURCES.map((option) => (
            <label
              key={option.source}
              className="cursor-pointer rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent has-checked:border-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="source"
                value={option.source}
                checked={source === option.source}
                onChange={() => setSource(option.source)}
                className="sr-only"
              />
              {SOURCE_LABELS[option.source]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="max-w-[65ch] text-sm text-pretty text-muted-foreground">{help}</p>

      <div className="space-y-2">
        <Label htmlFor="import-files">Files</Label>
        <input
          id="import-files"
          name="files"
          type="file"
          accept=".csv,text/csv"
          multiple
          required
          className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
      </div>

      <VisibilitySelect
        label="Who can see what is imported"
        name="visibility"
        defaultValue="public"
      />
      <p className="max-w-[65ch] text-sm text-pretty text-muted-foreground">
        Nothing you already have here is changed: a title that is in your library, rated, or
        reviewed keeps what you set.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Reading files…" : "Start import"}
        </Button>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </div>
    </form>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPORT_SOURCES, type ImportSource, isFileSource, SOURCES } from "@/lib/imports";
import { VISIBILITIES, VISIBILITY, type Visibility } from "@/lib/visibility";
import { useTRPC } from "@/trpc/client";
import { FileDrop } from "./file-drop";
import { type PlayedStatus, ProfileStep } from "./profile-step";
import { Segmented } from "./segmented";

// Matches the limits the API enforces.
const MAX_FILES = 8;
const MAX_FILE_CHARACTERS = 3_000_000;
const MAX_UPLOAD_CHARACTERS = 3_500_000;

const VISIBILITY_CHOICES = VISIBILITIES.map((value) => ({ value, ...VISIBILITY[value] }));

/** What the button says while the import is being set up, and what to say if that fails. */
const STARTING: Record<"files" | "steam" | "trakt", { busy: string; failed: string }> = {
  files: {
    busy: "Reading files…",
    failed: "The import could not be started. Check the files and try again.",
  },
  steam: {
    busy: "Asking Steam…",
    failed: "Steam could not be reached right now. Try again in a little while.",
  },
  trakt: {
    busy: "Asking Trakt…",
    failed: "Trakt could not be reached right now. Try again in a little while.",
  },
};

type Upload = { name: string; text: string }[];

/** Reads the chosen files, or says what is wrong with them. */
async function readUpload(chosen: File[]): Promise<{ files: Upload } | { problem: string }> {
  if (chosen.length === 0 || chosen.length > MAX_FILES) {
    return { problem: `Choose between 1 and ${MAX_FILES} files.` };
  }
  const files = await Promise.all(
    chosen.map(async (file) => ({ name: file.name, text: await file.text() })),
  );
  const tooLarge = files.find((file) => file.text.length > MAX_FILE_CHARACTERS);
  if (tooLarge) {
    return { problem: `${tooLarge.name} is too large to import. Files can be up to about 3 MB.` };
  }
  // The whole upload travels in one request, which the host caps at about 4.5 MB.
  const totalCharacters = files.reduce((sum, file) => sum + file.text.length, 0);
  if (totalCharacters > MAX_UPLOAD_CHARACTERS) {
    return { problem: "Those files are too large to send together. Import them a few at a time." };
  }
  if (files.some((file) => file.text.trim() === "")) {
    return { problem: "One of the files is empty. Choose the files again." };
  }
  return { files };
}

/** The API words a refused import for the person. Anything else is not theirs to fix. */
function fixableMessage(error: unknown): string | undefined {
  const { data, message } = error as { data?: { code?: string }; message?: string };
  return data?.code === "BAD_REQUEST" && message && !message.startsWith("[") ? message : undefined;
}

/**
 * Starts an import: pick the service, hand over its files or name the account, and say who may
 * see what comes across. The titles are matched on the import's own page.
 */
export function ImportStart() {
  const trpc = useTRPC();
  const router = useRouter();
  const [source, setSource] = useState<ImportSource>("letterboxd");
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [playedStatus, setPlayedStatus] = useState<PlayedStatus>("in_progress");
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const fromFiles = useMutation(trpc.imports.createFromFiles.mutationOptions());
  const fromSteam = useMutation(trpc.imports.createFromSteam.mutationOptions());
  const fromTrakt = useMutation(trpc.imports.createFromTrakt.mutationOptions());

  const { name, how } = SOURCES[source];
  const wording = STARTING[isFileSource(source) ? "files" : source];

  async function create(form: FormData): Promise<{ id: string } | { problem: string }> {
    if (isFileSource(source)) {
      const upload = await readUpload(files);
      if ("problem" in upload) return upload;
      return fromFiles.mutateAsync({ source, visibility, files: upload.files });
    }
    const account = String(form.get("profile"));
    return source === "steam"
      ? fromSteam.mutateAsync({ profile: account, visibility, playedStatus })
      : fromTrakt.mutateAsync({ profile: account, visibility });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setProblem(undefined);
    setStarting(true);
    try {
      const created = await create(form);
      if ("id" in created) {
        // Stays busy until the import's page opens, so a second press cannot start another.
        router.push(`/import/${created.id}`);
        return;
      }
      setProblem(created.problem);
    } catch (error) {
      setProblem(fixableMessage(error) ?? wording.failed);
    }
    setStarting(false);
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot be laid out as this grid of cards. */}
      <div className="sources" role="group" aria-label="Import from">
        {IMPORT_SOURCES.map((id) => (
          <button
            key={id}
            type="button"
            className="source"
            aria-pressed={source === id}
            onClick={() => {
              setSource(id);
              setProblem(undefined);
            }}
          >
            <b>{SOURCES[id].name}</b>
            <span>{SOURCES[id].brings}</span>
          </button>
        ))}
      </div>

      <section className="section panel" style={{ padding: 28 }} aria-label={`From ${name}`}>
        <form onSubmit={submit}>
          <div className="steps">
            <div className="step">
              <div>
                <h3>Get your data out of {name}</h3>
                <p className="dim">{how}</p>
              </div>
            </div>
            <div className="step">
              {isFileSource(source) ? (
                <div>
                  <h3>Add the files</h3>
                  <FileDrop sourceName={name} files={files} onChange={setFiles} />
                </div>
              ) : (
                <ProfileStep
                  source={source}
                  playedStatus={playedStatus}
                  onPlayedStatus={setPlayedStatus}
                />
              )}
            </div>
            <div className="step">
              <div>
                <h3>Who can see what is imported</h3>
                <Segmented
                  label="Who can see what is imported"
                  choices={VISIBILITY_CHOICES}
                  value={visibility}
                  onChange={setVisibility}
                />
              </div>
            </div>
          </div>
          <div className="startbar">
            <button type="submit" className="btn btn--primary btn--lg" disabled={starting}>
              {starting ? wording.busy : "Start import"}
            </button>
            {problem ? (
              <p role="alert" className="error">
                {problem}
              </p>
            ) : (
              <span className="hint">
                Titles are matched on the next page, a few at a time, while it is open.
              </span>
            )}
          </div>
        </form>
      </section>
    </>
  );
}

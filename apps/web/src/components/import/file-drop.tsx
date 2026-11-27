import { useState } from "react";
import { Icon } from "@/components/ui/icon";

type Props = {
  /** The service the files come from, named in the hint. */
  sourceName: string;
  files: File[];
  onChange: (files: File[]) => void;
};

/** Adds files to the ones already chosen. A file chosen again replaces its earlier copy. */
function withAdded(files: File[], added: File[]): File[] {
  const names = new Set(added.map((file) => file.name));
  return [...files.filter((file) => !names.has(file.name)), ...added];
}

/**
 * Where exported files go in: a target to drop them on, and an ordinary file input under it for
 * a keyboard or a screen reader. Files add up, so they can be brought over one at a time.
 */
export function FileDrop({ sourceName, files, onChange }: Props) {
  const [over, setOver] = useState(false);

  return (
    <>
      <label
        className="drop"
        htmlFor="import-files"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onChange(withAdded(files, [...event.dataTransfer.files]));
        }}
      >
        <Icon name="upload" size="lg" />
        <span>
          <b>Drop the files here</b>, or choose them
        </span>
        <span className="hint">CSV files, as {sourceName} names them</span>
        <input
          id="import-files"
          type="file"
          multiple
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            onChange(withAdded(files, [...(event.target.files ?? [])]));
            // Cleared so that choosing the same file again, after removing it, still counts.
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="files" aria-label="Files to import">
          {files.map((file) => (
            <li key={file.name} className="chip">
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((each) => each !== file))}
              >
                <Icon name="x" size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

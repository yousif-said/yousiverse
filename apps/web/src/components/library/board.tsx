"use client";

import { useMutation } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yousiverse/ui/components/dropdown-menu";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Medium } from "@/components/media/medium";
import { Score } from "@/components/media/score";
import { TitleRow } from "@/components/media/title-row";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import {
  isLibraryStatus,
  LIBRARY_STATUSES,
  type LibraryStatus,
  STATUS_ICONS,
  STATUS_LABELS,
  statusLabel,
} from "@/lib/library";
import {
  applyMoves,
  type BoardMoves,
  type LibraryListEntry,
  type LibrarySort,
  movesStillWaiting,
  withMove,
  withoutMove,
} from "@/lib/library-view";
import { useTRPC } from "@/trpc/client";

type Props = { entries: LibraryListEntry[]; sort: LibrarySort };

const columnId = (status: LibraryStatus) => `board-${status}`;
const menuId = (mediaId: string) => `board-menu-${mediaId}`;

type MenuProps = {
  entry: LibraryListEntry;
  /** Null takes the title out of the library. */
  onMove: (status: LibraryStatus | null) => void;
};

/** A row's way to change status without dragging: the four statuses, and taking it out. */
function StatusMenu({ entry, onMove }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={menuId(entry.mediaId)}
        className="board__menu"
        aria-label={`Move ${entry.title}`}
      >
        <Icon name="more" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={entry.status}
          onValueChange={(status) => {
            if (isLibraryStatus(status)) onMove(status);
          }}
        >
          {LIBRARY_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              <Icon name={STATUS_ICONS[status]} />
              {statusLabel(status, entry.type)}
              {status === entry.status && <Icon name="check" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onMove(null)}>
          <Icon name="trash" />
          Remove from library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The library as a board: a column per status, and titles that move between them by dragging
 * or from each row's menu. A move shows at once and is saved behind it; if saving fails the
 * title goes back and the board says so.
 */
export function LibraryBoard({ entries, sort }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const save = useMutation(trpc.library.save.mutationOptions());
  const remove = useMutation(trpc.library.remove.mutationOptions());

  const [moves, setMoves] = useState<BoardMoves>(new Map());
  const [listed, setListed] = useState(entries);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<LibraryStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // Where the keyboard's focus goes after a move from a menu, which unmounts the row it was on.
  const focusAfterMove = useRef<string | null>(null);

  // A fresh list from the server settles the moves it already shows.
  if (listed !== entries) {
    setListed(entries);
    setMoves(movesStillWaiting(moves, entries));
  }

  useEffect(() => {
    if (!focusAfterMove.current) return;
    document.getElementById(focusAfterMove.current)?.focus();
    focusAfterMove.current = null;
  });

  const shown = applyMoves(entries, moves, sort);

  async function move(entry: LibraryListEntry, status: LibraryStatus | null) {
    if (status === entry.status) return;
    const { mediaId, title, type } = entry;
    setFailure(null);
    setMoves((current) => withMove(current, mediaId, status));
    try {
      if (status) await save.mutateAsync({ mediaId, status });
      else await remove.mutateAsync({ mediaId });
    } catch {
      // Unless the title has been moved again since, in which case that move stands.
      setMoves((current) =>
        current.get(mediaId) === status ? withoutMove(current, mediaId) : current,
      );
      setFailure(
        status
          ? `${title} could not be moved. Check your connection and try again.`
          : `${title} could not be removed. Check your connection and try again.`,
      );
      return;
    }
    toast(
      status
        ? `${title}: ${statusLabel(status, type).toLowerCase()}`
        : `${title}: removed from your library`,
    );
    router.refresh();
  }

  function moveFromMenu(entry: LibraryListEntry, status: LibraryStatus | null) {
    if (status === entry.status) return;
    // The row lands in another column with its menu, or is gone and leaves its column.
    focusAfterMove.current = status ? menuId(entry.mediaId) : columnId(entry.status);
    void move(entry, status);
  }

  function startDrag(event: DragEvent<HTMLDivElement>, mediaId: string) {
    event.dataTransfer.setData("text/plain", mediaId);
    event.dataTransfer.effectAllowed = "move";
    // A drag begun on the title's link would carry only the link; carry the whole row instead.
    const row = event.currentTarget.getBoundingClientRect();
    event.dataTransfer.setDragImage(
      event.currentTarget,
      event.clientX - row.left,
      event.clientY - row.top,
    );
    setDragged(mediaId);
  }

  function endDrag() {
    setDragged(null);
    setOver(null);
  }

  function dragOver(event: DragEvent<HTMLElement>, status: LibraryStatus) {
    // Only a title picked up from this board can be dropped on it.
    if (!dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(status);
  }

  function leave(event: DragEvent<HTMLElement>, status: LibraryStatus) {
    // Passing over a row inside the column also counts as leaving it. Not every browser says
    // where the pointer went, so where it is decides.
    const column = event.currentTarget.getBoundingClientRect();
    const stillInside =
      event.clientX > column.left &&
      event.clientX < column.right &&
      event.clientY > column.top &&
      event.clientY < column.bottom;
    if (!stillInside) setOver((current) => (current === status ? null : current));
  }

  function drop(event: DragEvent<HTMLElement>, status: LibraryStatus) {
    event.preventDefault();
    const entry = shown.find((candidate) => candidate.mediaId === dragged);
    endDrag();
    if (entry) void move(entry, status);
  }

  return (
    <>
      {failure && (
        <p className="error mb-3.5" role="alert">
          {failure}
        </p>
      )}
      <div className="board">
        {LIBRARY_STATUSES.map((status) => {
          const inColumn = shown.filter((entry) => entry.status === status);
          return (
            <section
              key={status}
              id={columnId(status)}
              tabIndex={-1}
              className={cn("board__col", over === status && "over")}
              aria-label={STATUS_LABELS[status]}
              onDragOver={(event) => dragOver(event, status)}
              onDragLeave={(event) => leave(event, status)}
              onDrop={(event) => drop(event, status)}
            >
              <div className="board__head">
                <span>
                  <Icon name={STATUS_ICONS[status]} size="sm" /> {STATUS_LABELS[status]}
                </span>
                <span className="mono">{inColumn.length}</span>
              </div>
              {inColumn.map((entry) => (
                <TitleRow
                  key={entry.mediaId}
                  title={entry}
                  className={cn(dragged === entry.mediaId && "dragging")}
                  draggable
                  onDragStart={(event) => startDrag(event, entry.mediaId)}
                  onDragEnd={endDrag}
                  sub={
                    <>
                      <Medium type={entry.type} label={false} />
                      {entry.releaseYear !== null && <span>{entry.releaseYear}</span>}
                    </>
                  }
                  end={
                    <>
                      <Score value={entry.rating} />
                      <StatusMenu entry={entry} onMove={(next) => moveFromMenu(entry, next)} />
                    </>
                  }
                />
              ))}
            </section>
          );
        })}
      </div>
      <p className="hint mt-3.5">
        Drag a title to another column to change its status, or use the menu on its row.
      </p>
    </>
  );
}

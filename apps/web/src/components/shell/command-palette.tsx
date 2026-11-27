"use client";

import { Dialog, DialogContent, DialogTitle } from "@yousiverse/ui/components/dialog";
import { cn } from "cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { PaletteItem, PaletteLead } from "@/components/find/palette-items";
import { usePaletteGroups } from "@/components/find/use-palette-groups";
import { Thumb } from "@/components/media/artwork";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";

let isOpen = false;
/** What had focus when the palette opened, so focus can go back there when it closes. */
let opener: Element | null = null;
const listeners = new Set<() => void>();

function setOpen(next: boolean) {
  if (next === isOpen) return;
  if (next) opener = document.activeElement;
  isOpen = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens search from anywhere: the sidebar's button, the mobile bar, or a shortcut. */
export function openPalette(): void {
  setOpen(true);
}

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"));

/** ⌘K or Ctrl+K anywhere opens or closes search; "/" opens it unless something is being typed. */
function useShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!isOpen);
        return;
      }
      const plainSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      // A slash typed over an open dialog or menu belongs to it.
      const overlaid = document.querySelector('[role="dialog"], [role="menu"]');
      if (plainSlash && !isField(event.target) && !overlaid) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

function Lead({ lead }: { lead: PaletteLead }) {
  switch (lead.kind) {
    case "title":
      return <Thumb title={lead.title} link={false} />;
    case "person":
      return <Avatar username={lead.username} size={34} />;
    case "icon":
      return (
        <span className="pal__ico">
          <Icon name={lead.icon} />
        </span>
      );
  }
}

type ResultsProps = { signedIn: boolean; onClose: () => void };

/**
 * The palette's field and its results, as a combobox: focus stays in the field while the arrow
 * keys move through the list, Enter opens what is selected, and pointing at a row selects it.
 */
function Results({ signedIn, onClose }: ResultsProps) {
  const router = useRouter();
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [selected, setSelected] = useState(0);
  const groups = usePaletteGroups(typed, signedIn);
  const items = groups.flatMap((group) => group.items);
  const active = Math.min(selected, items.length - 1);
  const positionOf = new Map(items.map((item, position) => [item.key, position]));
  const optionId = (position: number) => `${id}-option-${position}`;

  function move(step: 1 | -1) {
    if (items.length === 0) return;
    const next = (active + step + items.length) % items.length;
    setSelected(next);
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(next))}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function open(item: PaletteItem) {
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) open(item);
    }
  }

  return (
    <>
      <div className="pal__in">
        <Icon name="search" size="lg" />
        <label className="sr-only" htmlFor={`${id}-field`}>
          Search
        </label>
        <input
          id={`${id}-field`}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={items[active] ? optionId(active) : undefined}
          placeholder="Search titles, people, lists, and clubs"
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          value={typed}
          onChange={(event) => {
            setTyped(event.currentTarget.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="kbd" aria-hidden="true">
          esc
        </span>
      </div>
      <div
        ref={listRef}
        className="pal__list"
        id={`${id}-list`}
        role="listbox"
        aria-label="Results"
      >
        {groups.map((group, groupIndex) => {
          const labelId = `${id}-group-${groupIndex}`;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a group of options in a listbox, not a form's fieldset.
            <div
              key={group.label ?? "search"}
              role="group"
              aria-labelledby={group.label ? labelId : undefined}
            >
              {group.label && (
                <div className="label pal__group" id={labelId}>
                  {group.label}
                </div>
              )}
              {group.note && <p className="pal__note">{group.note}</p>}
              {group.items.map((item) => {
                const position = positionOf.get(item.key) ?? 0;
                return (
                  <Link
                    key={item.key}
                    id={optionId(position)}
                    href={item.href}
                    // Results change with every search; loading each one ahead would open
                    // titles nobody asked for.
                    prefetch={false}
                    role="option"
                    aria-selected={position === active}
                    tabIndex={-1}
                    className={cn("pal__item", position === active && "sel")}
                    onClick={onClose}
                    onPointerMove={() => setSelected(position)}
                  >
                    <Lead lead={item.lead} />
                    <div className="min-w-0">
                      <b>{item.name}</b>
                      <span>{item.sub}</span>
                    </div>
                    <span className="kbd" aria-hidden="true">
                      ↵
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="pal__foot" aria-hidden="true">
        <span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> move
        </span>
        <span>
          <span className="kbd">↵</span> open
        </span>
        <span>
          <span className="kbd">esc</span> close
        </span>
      </div>
    </>
  );
}

/**
 * Search from anywhere: titles, people, youniverses, the person's lists and clubs, and every
 * place in the app. Rendered once, by the app shell.
 */
export function CommandPalette({ signedIn }: { signedIn: boolean }) {
  const open = useSyncExternalStore(
    subscribe,
    () => isOpen,
    () => false,
  );
  useShortcuts();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="pal"
        onCloseAutoFocus={(event) => {
          // There is no trigger for the dialog to return to: it opens from several places.
          event.preventDefault();
          if (opener instanceof HTMLElement) opener.focus();
        }}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Results signedIn={signedIn} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

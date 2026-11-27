"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icon";

type Toast = { id: number; message: string; leaving: boolean };

const SHOWN_MS = 2600;
const LEAVING_MS = 400;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function change(next: Toast[]) {
  toasts = next;
  for (const listener of listeners) listener();
}

/** Confirms something that just happened, in a few words, for a few seconds: "Added to Want". */
export function toast(message: string): void {
  const id = nextId++;
  change([...toasts, { id, message, leaving: false }]);
  setTimeout(() => {
    change(toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
  }, SHOWN_MS);
  setTimeout(() => change(toasts.filter((item) => item.id !== id)), SHOWN_MS + LEAVING_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const none: Toast[] = [];

/** Where toasts appear. Rendered once, by the app shell. */
export function Toaster() {
  const shown = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => none,
  );
  return (
    <div className="toasts" role="status" aria-live="polite">
      {shown.map(({ id, message, leaving }) => (
        <div key={id} className={leaving ? "toast out" : "toast"}>
          <Icon name="check" size="sm" />
          <span>{message}</span>
        </div>
      ))}
    </div>
  );
}

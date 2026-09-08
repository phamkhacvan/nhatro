import { useSyncExternalStore } from "react";

let dirty = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function setDirty(v: boolean): void {
  if (dirty !== v) {
    dirty = v;
    emit();
  }
}

export function isDirty(): boolean {
  return dirty;
}

export function subscribeDirty(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useDirty(): boolean {
  return useSyncExternalStore(subscribeDirty, isDirty);
}

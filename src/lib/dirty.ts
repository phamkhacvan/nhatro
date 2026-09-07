import { useSyncExternalStore } from "react";

type SaveHandler = () => Promise<boolean>;

let dirty = false;
let saveHandler: SaveHandler | null = null;
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

export function setDirtySaveHandler(h: SaveHandler | null): void {
  saveHandler = h;
}

export function getDirtySaveHandler(): SaveHandler | null {
  return saveHandler;
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

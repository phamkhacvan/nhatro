const listeners = new Set<() => void>();

export function emitRefresh(): void {
  listeners.forEach((l) => l());
}

export function subscribeRefresh(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
import { useSyncExternalStore } from 'react';

// Which cards have a 3D vampire that has drawn its first frame. Small on purpose:
// the page imports this at start, and the 3D chunk fills it in later.
const ready = new Set<number>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export function setPortraitReady(tabId: number, isReady: boolean): void {
  if (isReady === ready.has(tabId)) return;
  if (isReady) ready.add(tabId);
  else ready.delete(tabId);
  emit();
}

/** Forget everything, for example when the 3D layer is removed or fails. */
export function clearPortraitsReady(): void {
  if (ready.size === 0) return;
  ready.clear();
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True once this card's 3D vampire is on screen. Until then the 2D emblem shows. */
export function usePortraitReady(tabId: number): boolean {
  useSyncExternalStore(subscribe, () => version, () => version);
  return ready.has(tabId);
}

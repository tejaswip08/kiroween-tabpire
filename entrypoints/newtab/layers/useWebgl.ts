import { useSyncExternalStore } from 'react';

let available: boolean | null = null;

/**
 * Asks once whether WebGL 2 works. The answer is kept, because making a context
 * costs time and browsers limit how many can exist. Any failure means "no".
 */
export function detectWebgl(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (available !== null) return available;
  let ok = false;
  try {
    // A browser without the WebGL 2 type cannot make a WebGL 2 context. Skip the throwaway canvas.
    if (typeof WebGL2RenderingContext === 'undefined') {
      available = false;
      return false;
    }
    const canvas = doc?.createElement('canvas');
    const gl = canvas?.getContext('webgl2') as WebGL2RenderingContext | null | undefined;
    ok = !!gl;
    // Give the throwaway context back at once.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    ok = false;
  }
  available = ok;
  return ok;
}

/** For tests: forget the answer. */
export function resetWebglCheck(): void {
  available = null;
  state = { lost: false, epoch: 0 };
  emit();
}

interface ContextState {
  /** True while the WebGL context is lost. The page falls back to the 2D look. */
  lost: boolean;
  /** Goes up each time the context comes back, so the layers can mount fresh. */
  epoch: number;
}
let state: ContextState = { lost: false, epoch: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function reportContextLost(): void {
  if (state.lost) return;
  state = { ...state, lost: true };
  emit();
}
export function reportContextRestored(): void {
  if (!state.lost) return;
  state = { lost: false, epoch: state.epoch + 1 };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

/** Whether 3D can be shown now, and a key that changes when the context returns. */
export function useWebgl(): { available: boolean; lost: boolean; epoch: number } {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { available: detectWebgl(), lost: s.lost, epoch: s.epoch };
}

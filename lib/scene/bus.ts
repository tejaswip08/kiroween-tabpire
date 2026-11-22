// A very small event bus. The page tells the scene about one-off events.
export type SceneEvent =
  | { type: 'dawn'; closed: number }
  | { type: 'crypt' }
  | { type: 'stake' }
  | { type: 'coffin' };

type Listener = (e: SceneEvent) => void;
const listeners = new Set<Listener>();

export function onSceneEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitSceneEvent(e: SceneEvent): void {
  for (const fn of [...listeners]) fn(e);
}

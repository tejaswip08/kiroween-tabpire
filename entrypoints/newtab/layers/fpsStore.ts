import { useSyncExternalStore } from 'react';

export type FpsSource = 'scene' | 'portrait';

export interface FpsSnapshot {
  /** Frames per second over the last second (scene canvas). */
  fps: number;
  /** Longest frame time in the last second, in milliseconds. */
  worstMs: number;
  scene: { calls: number; triangles: number };
  portrait: { calls: number; triangles: number };
}

const WINDOW_MS = 1000;
const SLOTS = 512;
const PUBLISH_MS = 250;

/**
 * Collects frame times with fixed arrays, so recording a frame creates no objects.
 * Readers get a new snapshot at most every 250 ms.
 */
export function createFpsStore() {
  const times = new Float64Array(SLOTS);
  const dts = new Float64Array(SLOTS);
  let head = 0;
  let size = 0;
  let lastPublish = -Infinity;
  let snap: FpsSnapshot = { fps: 0, worstMs: 0, scene: { calls: 0, triangles: 0 }, portrait: { calls: 0, triangles: 0 } };
  const sceneInfo = { calls: 0, triangles: 0 };
  const portraitInfo = { calls: 0, triangles: 0 };
  const listeners = new Set<() => void>();

  function publish(now: number) {
    let count = 0;
    let worst = 0;
    for (let i = 0; i < size; i++) {
      const k = (head - 1 - i + SLOTS) % SLOTS;
      if (now - times[k]! > WINDOW_MS) break;
      count++;
      if (dts[k]! > worst) worst = dts[k]!;
    }
    snap = {
      fps: count,
      worstMs: worst,
      scene: { calls: sceneInfo.calls, triangles: sceneInfo.triangles },
      portrait: { calls: portraitInfo.calls, triangles: portraitInfo.triangles },
    };
    lastPublish = now;
    listeners.forEach((l) => l());
  }

  return {
    /** Call once per drawn frame. `dtMs` is the time since the previous frame. */
    record(source: FpsSource, now: number, dtMs: number, calls: number, triangles: number): void {
      const info = source === 'scene' ? sceneInfo : portraitInfo;
      info.calls = calls;
      info.triangles = triangles;
      if (source === 'scene') {
        times[head] = now;
        dts[head] = dtMs;
        head = (head + 1) % SLOTS;
        size = Math.min(SLOTS, size + 1);
      }
      if (now - lastPublish >= PUBLISH_MS) publish(now);
    },
    reset(): void {
      head = 0;
      size = 0;
      lastPublish = -Infinity;
      sceneInfo.calls = sceneInfo.triangles = portraitInfo.calls = portraitInfo.triangles = 0;
      snap = { fps: 0, worstMs: 0, scene: { calls: 0, triangles: 0 }, portrait: { calls: 0, triangles: 0 } };
      listeners.forEach((l) => l());
    },
    get: (): FpsSnapshot => snap,
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const fpsStore = createFpsStore();

export function useFps(): FpsSnapshot {
  return useSyncExternalStore(fpsStore.subscribe, fpsStore.get, fpsStore.get);
}

/** True when the page address ends with `#fps`. */
export function fpsRequested(href: string): boolean {
  return href.endsWith('#fps');
}

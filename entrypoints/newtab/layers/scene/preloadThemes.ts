import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import { ENABLED_THEME_IDS, type ThemeId } from '../../../../lib/themes';
import { modelFile } from '../../../../lib/scene/layout';
import { sceneThemeFor } from './themeColors';

/** The extension's own model files of a theme, through assetUrl. */
export const themeFiles = (id: ThemeId): string[] => {
  const { scene } = sceneThemeFor(id);
  return [...new Set([...scene.models, ...(scene.fill?.models ?? [])])].map(modelFile);
};

/** How many files one idle slot loads. */
export const PRELOAD_PER_SLOT = 2;
/** The wait before a slot where `requestIdleCallback` is missing. */
export const PRELOAD_FALLBACK_MS = 200;

/** Files already asked for, so each file is preloaded once. */
const asked = new Set<string>();
/** For tests. */
export const resetPreloadState = (): void => asked.clear();

export interface PreloadDeps {
  /** Starts one file load. Only the extension's own files reach it. */
  preload: (url: string) => void;
  /** Runs `fn` in the next idle slot and returns a cancel function. */
  schedule: (fn: () => void) => () => void;
  asked: Set<string>;
}

/** requestIdleCallback where it exists, otherwise a 200 ms timer. */
export function scheduleIdle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const h = requestIdleCallback(fn);
    return () => cancelIdleCallback(h);
  }
  const h = setTimeout(fn, PRELOAD_FALLBACK_MS);
  return () => clearTimeout(h);
}

const defaults: PreloadDeps = {
  preload: (url) => useGLTF.preload(url, false, true),
  schedule: scheduleIdle,
  asked,
};

/** The files of the other themes that nobody has asked for yet, each once, in theme order. */
export function pendingFiles(current: ThemeId, seen: ReadonlySet<string>): string[] {
  let own: Set<string>;
  try {
    own = new Set(themeFiles(current));
  } catch {
    own = new Set();
  }
  const out: string[] = [];
  for (const id of ENABLED_THEME_IDS) {
    if (id === current) continue;
    // One theme that cannot be built must not stop the others from loading.
    let files: string[];
    try {
      files = themeFiles(id);
    } catch (err) {
      console.warn(`Tabpire: could not list the files of the ${id} theme.`, err);
      continue;
    }
    for (const url of files) {
      if (own.has(url) || seen.has(url) || out.includes(url)) continue;
      out.push(url);
    }
  }
  return out;
}

/** Preloads the files of the other themes, two per idle slot. Returns a function that stops it. */
export function startThemePreload(current: ThemeId, deps: Partial<PreloadDeps> = {}): () => void {
  const d = { ...defaults, ...deps };
  let stopped = false;
  let cancel: (() => void) | undefined;
  const slot = () => {
    if (stopped) return;
    const next = pendingFiles(current, d.asked).slice(0, PRELOAD_PER_SLOT);
    if (next.length === 0) return;
    for (const url of next) {
      d.asked.add(url);
      try {
        d.preload(url);
      } catch (err) {
        console.warn(`Tabpire: could not preload ${url}.`, err);
      }
    }
    cancel = d.schedule(slot);
  };
  cancel = d.schedule(slot);
  return () => {
    stopped = true;
    cancel?.();
  };
}

/** After the scene's first frame (`ready`), preloads the other themes. Stops when the page goes away. */
export function useThemePreload(ready: boolean, current: ThemeId): void {
  useEffect(() => (ready ? startThemePreload(current) : undefined), [ready, current]);
}

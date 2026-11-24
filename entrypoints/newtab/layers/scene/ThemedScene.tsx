import { useGLTF } from '@react-three/drei';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThemeId } from '../../../../lib/themes';
import { themeFiles } from './preloadThemes';
import { SceneContents } from './SceneContents';
import { SceneThemeContext, sceneThemeFor } from './themeColors';
import { MoonAim } from './themes/MoonAim';
import { THEME_SCENES } from './themes';
import { ThemeSceneRoot } from './themes/ThemeSceneRoot';

/**
 * How a theme switch keeps the old scene on screen until the new one is ready (Requirement 11.9).
 * 'deferred' (the default) uses `useDeferredValue`: React builds the new tree in the background and keeps the
 * committed one while it suspends. 'gate' is the fallback: preload the new files, then set the shown id.
 * If a manual check in Chrome shows an empty frame during a switch, change this one constant to 'gate'.
 */
export const THEME_SWITCH: 'deferred' | 'gate' = 'deferred';

/** Loads the files of a theme. A rejection is fine: the switch still completes and the model boundary skips that file. */
export type ThemeLoader = (id: ThemeId) => Promise<unknown>;

/**
 * The default loader of the gate. It fills drei's cache with `useGLTF.preload` and waits on a second read of the
 * same extension files (served from the browser cache), so it settles when the files are in.
 */
export const loadThemeFiles: ThemeLoader = async (id) => {
  // drei is imported statically (a dynamic import of the whole package would stop tree-shaking and bundle its CDN strings).
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.allSettled(
    themeFiles(id).map((url) => {
      useGLTF.preload(url, false, true);
      return loader.loadAsync(url);
    }),
  );
};

/**
 * The manual gate. Returns the shown theme id: it starts as `themeId`, and after a change it stays on the old id
 * until `load(newId)` settles (resolved or rejected), then moves to the new id. A newer choice while loading
 * drops the older one, so only the latest is ever shown. With `enabled` false it returns `themeId` as it is.
 */
export function useThemeGate(themeId: ThemeId, load: ThemeLoader, enabled = true): ThemeId {
  const [shown, setShown] = useState(themeId);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    if (!enabled || themeId === shownRef.current) return undefined;
    let current = true;
    const done = () => {
      if (current) setShown(themeId);
    };
    let started: Promise<unknown>;
    try {
      started = Promise.resolve(load(themeId));
    } catch {
      started = Promise.resolve();
    }
    started.then(done, done);
    return () => {
      current = false;
    };
  }, [themeId, load, enabled]);
  return enabled ? shown : themeId;
}

/**
 * The scene of the Active_Theme. The theme data changes only when the new scene can be drawn, in one commit,
 * so the canvas is never empty. A unique theme (one in `THEME_SCENES`) loads its files inside the same Suspense, so it
 * keeps the old scene on screen exactly as the others do. There is no cross-fade, so reduced motion gets the same hard cut.
 */
export function ThemedScene({
  themeId,
  mode = THEME_SWITCH,
  load = loadThemeFiles,
  scene,
}: {
  themeId: ThemeId;
  mode?: 'deferred' | 'gate';
  load?: ThemeLoader;
  /** The scene contents. Tests pass a smaller scene. */
  scene?: ReactNode;
}) {
  const deferred = useDeferredValue(themeId);
  const gated = useThemeGate(themeId, load, mode === 'gate');
  const shown = mode === 'gate' ? gated : deferred;
  const value = useMemo(() => sceneThemeFor(shown), [shown]);
  // The Crypt, and a theme that has no scene of its own yet, draw the Crypt scene. A unique theme draws its own.
  const own = shown !== 'crypt' && THEME_SCENES[shown] !== undefined;
  return (
    <SceneThemeContext value={value}>
      <MoonAim id={shown} />
      {scene ?? (own ? <ThemeSceneRoot id={shown} /> : <SceneContents />)}
    </SceneThemeContext>
  );
}

import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { themeScene, type ThemeScene } from '../../../../lib/scene/themeLayout';
import { DEFAULT_THEME, DISABLED_THEMES, type ThemeId } from '../../../../lib/themes';
import { sceneColorsFor, type SceneColors } from './colors';

export type { ThemeScene };
export interface SceneTheme {
  id: ThemeId;
  colors: SceneColors;
  scene: ThemeScene;
}
const cache = new Map<ThemeId, SceneTheme>();
/** The scene data of one theme, built once per theme so a switch changes the context value only once. */
export function sceneThemeFor(requested: ThemeId): SceneTheme {
  // A disabled theme is never built: it is the Crypt.
  const id = DISABLED_THEMES.includes(requested) ? DEFAULT_THEME : requested;
  let hit = cache.get(id);
  if (!hit) {
    hit = { id, colors: sceneColorsFor(id), scene: themeScene(id) };
    cache.set(id, hit);
  }
  return hit;
}
export const CRYPT_SCENE_THEME: SceneTheme = sceneThemeFor('crypt');
export const SceneThemeContext = createContext<SceneTheme>(CRYPT_SCENE_THEME);
export const useSceneTheme = (): SceneTheme => useContext(SceneThemeContext);

/**
 * Runs `apply` once when the colour set changes (on mount and on a switch), then asks for one redraw.
 * Never per frame, and not on a re-render with the same colours.
 */
export function useColorSync(apply: (c: SceneColors) => void): void {
  const { colors } = useSceneTheme();
  const invalidate = useThree((s) => s.invalidate);
  const latest = useRef(apply);
  latest.current = apply;
  useLayoutEffect(() => {
    latest.current(colors);
    invalidate();
  }, [colors, invalidate]);
}

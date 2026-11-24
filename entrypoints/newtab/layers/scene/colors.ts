import { Color, LinearSRGBColorSpace } from 'three';
import type { ScenePalette, ThemeId } from '../../../../lib/themes';
import { themeById } from '../../../../lib/themes';
import { ACCENT, COLD, CRYPT_EXTRA, WARM } from '../../../../lib/scene/palette';

/** Palette colours as three colours (converted to linear by three). Shared, never changed. */
export const C = {
  skyTop: new Color(COLD.skyTop),
  fog: new Color(COLD.fog),
  hemiSky: new Color(COLD.hemisphereSky),
  hemiGround: new Color(COLD.hemisphereGround),
  rim: new Color(COLD.rim),
  candle: new Color(WARM.candle),
  lantern: new Color(WARM.lantern),
  jack: new Color(WARM.jackOLantern),
  ember: new Color(WARM.ember),
  door: new Color(WARM.cryptDoor),
  moon: new Color(ACCENT.moon),
  moonlight: new Color(ACCENT.moonlight),
  /** Warm violet-crimson at the horizon and the haze around the moon. */
  horizon: new Color(CRYPT_EXTRA.skyHorizon),
  mid: new Color(CRYPT_EXTRA.skyMid),
  haze: new Color(CRYPT_EXTRA.haze),
  mushroom: new Color(CRYPT_EXTRA.mushroom),
  cauldron: new Color(CRYPT_EXTRA.cauldron),
  wisp: new Color(CRYPT_EXTRA.wisp),
  ghost: new Color(CRYPT_EXTRA.ghost),
};

/** One three colour per ScenePalette key. */
export type SceneColors = { readonly [K in keyof ScenePalette]: Color };
/** Keys whose three numbers are linear RGB, as a shader uses them. */
const LINEAR_KEYS = ['moonLight', 'moonDark', 'cloudBody', 'cloudTint'] as const;
const cache = new Map<ThemeId, SceneColors>();
/**
 * The colours of one theme, built once and then shared (never change them; copy from them).
 * For the Crypt they equal `C` and the shader literals the scene used before themes.
 */
export function sceneColorsFor(id: ThemeId): SceneColors {
  const hit = cache.get(id);
  if (hit) return hit;
  const palette = themeById(id).scene;
  const out: Record<string, Color> = {};
  for (const [key, value] of Object.entries(palette)) {
    if ((LINEAR_KEYS as readonly string[]).includes(key)) {
      const [r, g, b] = value as readonly [number, number, number];
      out[key] = new Color().setRGB(r, g, b, LinearSRGBColorSpace);
    } else {
      out[key] = new Color(value as string);
    }
  }
  const colors = out as unknown as SceneColors;
  cache.set(id, colors);
  return colors;
}

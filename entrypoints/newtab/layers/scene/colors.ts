import { Color } from 'three';
import { ACCENT, COLD, WARM } from '../../../../lib/scene/palette';

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
  horizon: new Color('#5c1a5c'),
  mid: new Color('#2a0e58'),
  haze: new Color('#74205c'),
  ghost: new Color('#a8f0d0'),
};

// Colours for the scene. Cold light and warm light are kept apart on purpose,
// so the contrast between them can be tested by hue.

export const COLD = {
  // The first prototype's sky: deep violet at the top to rose-pink at the horizon, with a violet fog.
  skyTop: '#170838',
  fog: '#592176',
  hemisphereSky: '#9a78ff',
  hemisphereGround: '#4a2a78',
  rim: '#9a86ff',
} as const;

export const WARM = {
  candle: '#ffb347',
  lantern: '#ff9a3d',
  jackOLantern: '#ff8a1c',
  ember: '#ff6a1f',
  cryptDoor: '#ffb066',
} as const;

export const ACCENT = {
  moon: '#ff2d45',
  moonlight: '#e2809c',
} as const;

/** Crypt colours that used to sit as literals in colors.ts and the scene components. */
export const CRYPT_EXTRA = {
  skyMid: '#3a1468',
  skyHorizon: '#a4377f',
  haze: '#c45a9e',
  mushroom: '#35e8d0',
  cauldron: '#5cff58',
  wisp: '#58f0c8',
  ghost: '#a8f0d0',
  // Soft pink-magenta clouds along the horizon.
  lowCloud: '#e07cb0',
  farSilhouette: '#190c36',
  groundBase: '#2d2832',
  groundTint: '#b4aab4',
  /** The mausoleum's doorway glows soft purple, and the blood moon throws a red rim light. */
  door: '#b57cff',
  rim: '#b0588c',
} as const;
/** Crypt shader literals, linear RGB (the numbers the GPU sees). */
export const CRYPT_SHADER = {
  // A glowing red blood moon with subtle darker craters.
  moonLight: [0.82, 0.03, 0.035],
  moonDark: [0.42, 0.012, 0.016],
  cloudBody: [0.045, 0.045, 0.1],
  cloudTint: [0.2, 0.07, 0.12],
} as const;
/** Hue in degrees from 0 to 360 for a `#rrggbb` colour. Grey has hue 0. */
export function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export const COLD_HUE_RANGE = [210, 280] as const;
export const WARM_HUE_RANGE = [10, 50] as const;

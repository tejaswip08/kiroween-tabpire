// Weather particle specs. Pure: counts and sizes only. The drawing is in layers/scene/Weather.tsx.
import type { WeatherKind } from '../themes';
import { mulberry32 } from './rng';

export interface WeatherSpec {
  kind: WeatherKind;
  /** Particles drawn. */
  count: number;
  /** Particles drawn when the display asks for reduced motion. */
  reducedCount: number;
  blending: 'normal' | 'additive';
}

export const WEATHER: Record<WeatherKind, WeatherSpec> = {
  snow: { kind: 'snow', count: 1200, reducedCount: 300, blending: 'normal' },
  ash: { kind: 'ash', count: 700, reducedCount: 175, blending: 'normal' },
  fireflies: { kind: 'fireflies', count: 120, reducedCount: 30, blending: 'additive' },
  leaves: { kind: 'leaves', count: 220, reducedCount: 55, blending: 'normal' },
  embers: { kind: 'embers', count: 96, reducedCount: 24, blending: 'additive' },
};

/** Most anchors the castle embers can use. */
export const MAX_ANCHORS = 4;
/** `uTime` while reduced motion is on: the particles stand still at this moment. */
export const REDUCED_TIME = 37;
/** Weather is one `<points>` object, so one draw call. The Crypt has none. */
export const WEATHER_DRAWS = 1;
/** Each particle counts as two triangles in the budget plan. */
export const weatherTriangles = (spec: WeatherSpec | null): number => (spec ? 2 * spec.count : 0);
export const weatherDraws = (spec: WeatherSpec | null): number => (spec ? WEATHER_DRAWS : 0);
const SEED: Record<WeatherKind, number> = { snow: 5101, ash: 5203, fireflies: 5303, leaves: 5407, embers: 5501 };
/** Seeds (x, z, phase, size), four numbers per particle in 0..1. Same kind and count, same numbers. */
export function weatherSeeds(kind: WeatherKind, count: number): Float32Array {
  const rng = mulberry32(SEED[kind]);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < out.length; i++) out[i] = rng();
  return out;
}
/** Particles to draw. */
export const weatherDrawCount = (spec: WeatherSpec, reduced: boolean): number => (reduced ? spec.reducedCount : spec.count);
/** The anchors the embers use: the first four, or one at the origin when the theme has none. */
export function emberAnchors(anchors: readonly { x: number; y: number; z: number }[]): { x: number; y: number; z: number }[] {
  const a = anchors.slice(0, MAX_ANCHORS);
  return a.length ? a : [{ x: 0, y: 0, z: 0 }];
}

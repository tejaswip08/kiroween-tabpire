// The aurora of the Frozen Cemetery: a strong green-teal ribbon (with a fainter blue one) slowly waving across the night sky. Pure numbers shared by the shader and
// the tests. The bands never light the moon disc: they fade out around it (`auroraClearance`).
import { MOON } from './sky';

/** Brightest an aurora pixel may add to the sky (before the clearance around the moon). Strong, but kept under the Bloom threshold. */
export const AURORA_PEAK = 0.46;
/** Within this many moon-disc radii of the moon the aurora is fully off. */
export const AURORA_OFF_DISCS = 2.5;
/** From this many moon-disc radii on, the aurora is at full strength. */
export const AURORA_FULL_DISCS = 6;
/** How fast the bands drift (radians of phase per second). Slow. */
export const AURORA_SPEED = 0.08;
/** Bands live between these elevations (y of the sky direction). The visible sky above the horizon is about 0 to 0.25. */
export const AURORA_ELEVATION: readonly [number, number] = [0.0, 0.4];

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 over the moon disc and its near surroundings, 1 far from it. `angleDeg` is the angle from the moon centre, `moonScale` its size. */
export function auroraClearance(angleDeg: number, moonScale: number): number {
  const disc = MOON.discDeg * moonScale;
  return smooth(disc * AURORA_OFF_DISCS, disc * AURORA_FULL_DISCS, angleDeg);
}

/** The most the aurora can add at an angle from the moon. Zero over the disc. */
export const auroraCeiling = (angleDeg: number, moonScale: number): number => AURORA_PEAK * auroraClearance(angleDeg, moonScale);

/** Triangles and draw calls of the aurora dome (one mesh). */
export const AURORA_TRIS = 24 * 12 * 2;
export const AURORA_CALLS = 1;

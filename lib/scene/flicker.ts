// Gentle flicker for flames and warm lights. Pure.

/**
 * A number near 1. Three slow sine waves with different speeds give a flicker that
 * never jumps. `seed` makes each light different. With reduced motion it is always 1.
 */
export function flicker(t: number, seed: number, reduced = false): number {
  if (reduced) return 1;
  const s = seed * 1.7;
  return (
    1 +
    0.09 * Math.sin(t * 7.3 + s) +
    0.05 * Math.sin(t * 13.1 + 2 * s) +
    0.03 * Math.sin(t * 23.7 + 3 * s)
  );
}

export const FLICKER_MIN = 0.82;
export const FLICKER_MAX = 1.18;

import { Shape, ShapeGeometry } from 'three';

/**
 * The witch, seen from the side and facing right (the way she flies). Units are about a body length.
 * Every part is a plain filled polygon, so she reads as a clear silhouette even when small.
 */
type Pt = readonly [number, number];
const poly = (pts: readonly Pt[]): Shape => {
  const s = new Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
};

/** The broom handle (long and thin) and the straw bristles at the back, as separate ragged spikes. */
export const BROOM: readonly (readonly Pt[])[] = [
  [[-1.7, -0.06], [1.55, 0.1], [1.6, 0.18], [-1.7, 0.05]],
  [[-1.65, 0.0], [-2.65, 0.5], [-2.55, 0.28]],
  [[-1.65, 0.0], [-2.8, 0.26], [-2.7, 0.06]],
  [[-1.65, 0.0], [-2.85, 0.0], [-2.7, -0.15]],
  [[-1.65, 0.0], [-2.75, -0.24], [-2.55, -0.38]],
  [[-1.65, 0.0], [-2.5, -0.5], [-2.3, -0.5]],
  // The binding around the straw.
  [[-1.78, 0.2], [-1.62, 0.2], [-1.58, -0.2], [-1.76, -0.2]],
];

/** Body: the seated torso leaning forward, an arm to the handle, a dangling leg with a pointed boot, the head with a nose. */
export const BODY: readonly (readonly Pt[])[] = [
  [[-0.5, 0.1], [0.12, 0.1], [0.4, 0.95], [-0.05, 1.05]],
  [[0.05, 0.1], [0.55, 0.16], [0.82, -0.5], [1.12, -0.58], [1.1, -0.72], [0.62, -0.7], [0.4, -0.05]],
  [[0.1, 0.78], [0.55, 0.5], [0.95, 0.2], [0.96, 0.28], [0.62, 0.66], [0.2, 0.98]],
  [[0.05, 1.0], [0.55, 1.0], [0.6, 1.2], [0.7, 1.15], [0.58, 1.38], [0.1, 1.4]],
];
/** The hat: a wide brim and a tall crooked cone whose tip folds back. */
export const HAT: readonly (readonly Pt[])[] = [
  [[-0.12, 1.34], [0.85, 1.4], [0.85, 1.5], [-0.12, 1.46]],
  [[0.04, 1.44], [0.66, 1.46], [0.5, 1.95], [0.3, 2.3], [-0.2, 2.62], [-0.55, 2.52], [-0.18, 2.3], [0.02, 1.9]],
];

/** The cloak: one ragged piece that streams back from her shoulders. The scene ripples its points. */
export const CLOAK: readonly Pt[] = [
  [0.3, 1.0], [-0.1, 1.08], [-0.7, 0.92], [-1.3, 0.72], [-1.75, 0.62], [-1.5, 0.42], [-2.0, 0.3], [-1.55, 0.14], [-1.95, -0.05],
  [-1.4, -0.12], [-1.62, -0.38], [-1.05, -0.28], [-1.15, -0.62], [-0.62, -0.38], [-0.5, -0.78], [-0.1, -0.42], [0.08, -0.7], [0.28, -0.1], [0.4, 0.4],
];

export const makeBroomGeometry = () => new ShapeGeometry(BROOM.map(poly));
export const makeBodyGeometry = () => new ShapeGeometry([...BODY, ...HAT].map(poly));
export const makeCloakGeometry = () => new ShapeGeometry(poly(CLOAK));

/**
 * Ripples the cloak: points farther from the shoulders move more, in a wave that runs down the cloak.
 * Writes into the geometry's own position array, so nothing is created per frame.
 */
export function rippleCloak(geometry: ShapeGeometry, base: Float32Array, time: number, amount = 1): void {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]!;
    const y = base[i * 3 + 1]!;
    const k = Math.min(1, Math.max(0, (0.3 - x) / 2.3));
    pos.setY(i, y + amount * k * (0.2 * Math.sin(time * 4.2 - x * 3.1) + 0.07 * Math.sin(time * 7.3 - x * 5.0 + y * 2.0)));
    pos.setX(i, x - amount * k * 0.05 * Math.sin(time * 3.1 - x * 2.0));
  }
  pos.needsUpdate = true;
}

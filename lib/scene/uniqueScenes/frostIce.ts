// The ice of the Frozen Cemetery: the lake, the icicles under the gravestone tops and the snow mounds. Pure and seeded.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { MODELS, type Placement } from '../layout';
import { mulberry32 } from '../rng';

/** The round frozen pond on the left, in the middle distance, beside the path: dark ice lying flat on the snow. */
export const LAKE = { x: -14.5, z: -21, rx: 5.2, rz: 4.6 } as const;
/** Segments of the lake disc, so its triangles are known. */
export const LAKE_SEGMENTS = 48;
/** The top of the ice is this far above the snow, so the two never fight over the depth. */
export const LAKE_Y = 0.06;

/** Normalised distance from the lake centre: below 1 is on the ice, 1 is the shore. `margin` widens the lake by that many units. */
export function lakeDistance(x: number, z: number, margin = 0): number {
  return Math.hypot((x - LAKE.x) / (LAKE.rx + margin), (z - LAKE.z) / (LAKE.rz + margin));
}
/** True when a point (with a radius) touches the ice. */
export const onLake = (x: number, z: number, radius = 0): boolean => lakeDistance(x, z, radius) < 1;

/** The deepest a gravestone sits in the ice (its placement `y` is minus its sink). Only placements flagged in `spec.sunk` may go below the ground. */
export const MAX_SINK = 0.6;

/** One icicle: it hangs from (x, y, z) straight down. */
export interface Icicle {
  x: number;
  y: number;
  z: number;
  length: number;
  radius: number;
}
export const ICICLES_PER_STONE = 7;
/** Triangles of one icicle: a cone with five sides and no base. */
export const ICICLE_TRIS = 5;

/** Turns a point the way `compose` turns a prop: Euler order YXZ, so first about z, then x, then y. */
export function turnLikeCompose(v: readonly [number, number, number], rotY: number, tilt: readonly [number, number] | undefined): [number, number, number] {
  const [tx, tz] = tilt ?? [0, 0];
  let [x, y, z] = v;
  // about z
  [x, y] = [x * Math.cos(tz) - y * Math.sin(tz), x * Math.sin(tz) + y * Math.cos(tz)];
  // about x
  [y, z] = [y * Math.cos(tx) - z * Math.sin(tx), y * Math.sin(tx) + z * Math.cos(tx)];
  // about y
  [x, z] = [x * Math.cos(rotY) + z * Math.sin(rotY), -x * Math.sin(rotY) + z * Math.cos(rotY)];
  return [x, y, z];
}

/** Icicles under the tops of some gravestones: each hangs from the face of a stone, near the top, and points straight down. */
export function icicleSet(stones: readonly Placement[], seed: number, perStone = ICICLES_PER_STONE): Icicle[] {
  const rng = mulberry32(seed);
  const out: Icicle[] = [];
  for (const s of stones) {
    const info = MODELS[s.model];
    for (let i = 0; i < perStone; i++) {
      const lx = (rng() * 2 - 1) * info.hx * 0.7 * s.scale;
      const ly = info.h * (0.62 + 0.26 * rng()) * s.scale;
      const lz = (rng() < 0.5 ? -1 : 1) * info.hz * 0.95 * s.scale;
      const [dx, dy, dz] = turnLikeCompose([lx, ly, lz], s.rotY, s.tilt);
      out.push({ x: s.x + dx, y: s.y + dy, z: s.z + dz, length: 0.5 + 0.7 * rng(), radius: 0.09 + 0.06 * rng() });
    }
  }
  return out;
}

/** A snow mound: a smooth, squashed icosahedron half sunk in the snow. A drift is a long, low mound (`stretch` along x, `squash` for the height). */
export interface Mound {
  x: number;
  z: number;
  radius: number;
  rotY: number;
  /** Length along its own x axis, as a multiple of the radius. Missing is 1. */
  stretch?: number;
  /** Height as a fraction of the radius. Missing is `MOUND_SQUASH`. */
  squash?: number;
  /** Height of its centre. Missing is `MOUND_Y`. */
  y?: number;
}
export const MOUND_COUNT = 40;
/** Mounds are this much lower than wide. */
export const MOUND_SQUASH = 0.34;
/** The centre of a mound is this far below the snow level, so it rises out of the snow with no edge. */
export const MOUND_Y = -0.06;
/** Triangles of one mound: an icosahedron with one level of detail. */
export const MOUND_TRIS = 80;

/** Half the visible width at a camera depth, as a fraction of the depth, at the narrowest window shape (16:10), kept a little short. */
const VISIBLE_HALF = 0.55;
/**
 * Seeded mounds on the snow. They keep off the lake and out of the near corners (never cut by the screen edge), and `blocked`
 * lets the scene keep them off its gravestones.
 */
export function moundSet(seed: number, blocked: (x: number, z: number, r: number) => boolean = () => false, count = MOUND_COUNT): Mound[] {
  const rng = mulberry32(seed);
  const out: Mound[] = [];
  for (let n = 0; n < count; n++) {
    for (let t = 0; t < 40; t++) {
      const radius = 0.7 + rng() * 1.1;
      const x = -27 + rng() * 54;
      const z = -33 + rng() * 40;
      const depth = 16 - z;
      const visible = Math.abs(x - 0.5) + radius + 0.5 <= VISIBLE_HALF * depth;
      if (z > 4 || !visible || onLake(x, z, radius + 0.6) || blocked(x, z, radius)) continue;
      if (out.some((m) => Math.hypot(m.x - x, m.z - z) < m.radius + radius)) continue;
      out.push({ x, z, radius, rotY: rng() * Math.PI * 2 });
      break;
    }
  }
  return out;
}

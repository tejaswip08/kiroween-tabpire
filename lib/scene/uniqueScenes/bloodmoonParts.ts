// The parts of the Blood Moon that the scene draws itself or lays out by rule: the stepped stone platform under the ruins,
// the ring of columns around the pedestal and the lava cracks in the ground. Pure and seeded, no three.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { GROUND, MODELS, type ModelId } from '../layout';
import { mulberry32 } from '../rng';
import { turnLikeCompose } from './frostIce';

// ---------- the ruins and the platform ----------

/** The ruins stand centre-back. Their file is 30 wide and 24.4 deep (see `MODELS.blood_ruins`), so they sit right at the back edge of the ground. */
export const RUINS = { x: 0.5, z: -27.7, rotY: 0, scale: 1 } as const;

/** One step of the platform: a box from the ground up to `top`. */
export interface PlatformStep {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  top: number;
}
export const PLATFORM_STEP_COUNT = 3;
/** Each step is this much higher than the one below it. */
export const PLATFORM_RISE = 0.3;
/** The top of the platform: the ruins stand on it (their placement `y`). */
export const PLATFORM_TOP = PLATFORM_STEP_COUNT * PLATFORM_RISE;
/** Triangles of the merged platform: one box per step, 12 triangles each. */
export const PLATFORM_TRIS = PLATFORM_STEP_COUNT * 12;

/**
 * Wide low steps around the footprint of a prop, outermost first (so the list goes up). The top step reaches `side` beyond the
 * footprint at the sides and the back and `front` toward the camera; each step down is wider by `stride` (and by a half of it
 * at the front, so the platform does not run into the ring of columns).
 */
export function platformSteps(
  centre: { x: number; z: number },
  half: { hx: number; hz: number },
  count = PLATFORM_STEP_COUNT,
  rise = PLATFORM_RISE,
  side = 1.2,
  front = 0.5,
  stride = 1.8,
): PlatformStep[] {
  const out: PlatformStep[] = [];
  for (let k = 0; k < count; k++) {
    const out_ = count - 1 - k; // how many steps this one is below the top
    out.push({
      x0: centre.x - half.hx - side - out_ * stride,
      x1: centre.x + half.hx + side + out_ * stride,
      z0: centre.z - half.hz - side - out_ * stride,
      z1: centre.z + half.hz + front + (out_ * stride) / 2,
      top: (k + 1) * rise,
    });
  }
  return out;
}

/** True when a point is over the platform (its outermost step), widened by `margin`. */
export const onPlatform = (steps: readonly PlatformStep[], x: number, z: number, margin = 0): boolean => {
  const o = steps[0];
  return !!o && x >= o.x0 - margin && x <= o.x1 + margin && z >= o.z0 - margin && z <= o.z1 + margin;
};

// ---------- the ritual circle ----------

/** The pedestal in the middle of the ring, in front of the ruins. */
export const PEDESTAL = { x: 0.5, z: -7.6, scale: 1.4 } as const;
export const RING = { radius: 4.5, count: 8, start: Math.PI / 8 } as const;

export interface RingSlot {
  x: number;
  z: number;
  /** Angle around the centre, in radians. */
  angle: number;
}
/** Points evenly spaced on a circle around a centre, `count` of them, the first at angle `start`. */
export function ringSlots(centre: { x: number; z: number }, radius: number, count: number, start = 0): RingSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = start + (i / count) * Math.PI * 2;
    return { x: centre.x + Math.cos(angle) * radius, z: centre.z + Math.sin(angle) * radius, angle };
  });
}

export type RingModel = Extract<ModelId, 'blood_column' | 'blood_column_round'>;
/**
 * What stands in each slot of the ring, in order. The tall square columns are whole or leaning; the short round ones are
 * the broken stumps. `tilt` is the lean about x and z in radians.
 */
export interface RingPiece {
  model: RingModel;
  scale: number;
  tilt: [number, number];
}
export const RING_PIECES: readonly RingPiece[] = [
  { model: 'blood_column', scale: 1.3, tilt: [0, 0] },
  { model: 'blood_column_round', scale: 1.5, tilt: [0, 0] },
  { model: 'blood_column', scale: 1.25, tilt: [0.07, -0.06] },
  { model: 'blood_column_round', scale: 1.3, tilt: [0.08, 0.1] },
  { model: 'blood_column', scale: 1.4, tilt: [0, 0] },
  { model: 'blood_column_round', scale: 1.6, tilt: [-0.1, 0.12] },
  { model: 'blood_column', scale: 1.3, tilt: [-0.06, 0.07] },
  { model: 'blood_column_round', scale: 1.4, tilt: [0, 0] },
];

/**
 * How high the highest corner of the base of a leaning prop rises above the point it leans about (the prop turns about the middle
 * of its base). A prop that leans is lowered by this much, so its high side just touches the ground and its low side goes into it.
 */
export function leanRise(model: ModelId, scale: number, tilt: readonly [number, number]): number {
  const { hx, hz } = MODELS[model];
  let rise = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) rise = Math.max(rise, turnLikeCompose([sx * hx * scale, 0, sz * hz * scale], 0, tilt)[1]);
  }
  return rise;
}
/** How far a leaning prop is sunk: its lean rise, rounded up to the millimetre, or 0 when it stands upright. */
export const sinkOf = (model: ModelId, scale: number, tilt: readonly [number, number]): number => {
  const rise = leanRise(model, scale, tilt);
  return rise < 0.005 ? 0 : Math.ceil(rise * 1000) / 1000;
};

// ---------- the lava cracks ----------

/** The cracks lie this far above the ground (the ground is flat), so the two never fight over the depth. */
export const CRACK_Y = 0.05;
/** The most triangles the crack ribbon may have. */
export const CRACK_TRI_LIMIT = 900;
/** A crack: a line of points on the ground and half its width at the root (it narrows to the tip). */
export interface Crack {
  points: [number, number][];
  halfWidth: number;
}

/** Half the visible width at a camera depth, as a fraction of the depth, at the narrowest window shape (16:10), kept a little short. */
const VISIBLE_HALF = 0.5;
const visible = (x: number, z: number) => z <= 4 && Math.abs(x - 0.5) + 0.4 <= VISIBLE_HALF * (16 - z);

/**
 * A network of cracks: twelve main cracks that wander over the ground in front of the ruins, some with branches. A crack stops
 * where it would leave the view, the ground or the area `blocked` keeps free (under the platform).
 */
export function crackNetwork(seed: number, blocked: (x: number, z: number) => boolean = () => false): Crack[] {
  const rng = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const out: Crack[] = [];
  let tris = 0;
  const allowed = (x: number, z: number) => visible(x, z) && z >= -36 && x >= GROUND.minX && x <= GROUND.maxX && !blocked(x, z);
  const walk = (x: number, z: number, heading: number, steps: number, halfWidth: number): Crack | null => {
    const points: [number, number][] = [[x, z]];
    for (let i = 0; i < steps; i++) {
      heading += between(-0.55, 0.55);
      const step = between(1.6, 2.6);
      x += Math.cos(heading) * step;
      z += Math.sin(heading) * step;
      if (!allowed(x, z)) break;
      points.push([x, z]);
    }
    return points.length >= 3 && tris + 2 * (points.length - 1) <= CRACK_TRI_LIMIT ? { points, halfWidth } : null;
  };
  for (let n = 0; n < 12; n++) {
    let main: Crack | null = null;
    for (let t = 0; t < 30 && !main; t++) {
      const x = 0.5 + between(-13, 13);
      const z = between(-26, 0);
      if (!allowed(x, z)) continue;
      main = walk(x, z, between(0, Math.PI * 2), 8 + Math.floor(rng() * 6), between(0.28, 0.42));
    }
    if (!main) continue;
    out.push(main);
    tris += 2 * (main.points.length - 1);
    // Branches leave from some of its points.
    main.points.forEach(([bx, bz], i) => {
      if (i === 0 || i === main!.points.length - 1 || rng() > 0.3) return;
      const prev = main!.points[i - 1]!;
      const heading = Math.atan2(bz - prev[1], bx - prev[0]) + (rng() < 0.5 ? -1 : 1) * between(0.6, 1.0);
      const branch = walk(bx, bz, heading, 3 + Math.floor(rng() * 4), between(0.16, 0.24));
      if (!branch) return;
      out.push(branch);
      tris += 2 * (branch.points.length - 1);
    });
  }
  return out;
}

/** The ribbon of all cracks as plain arrays (the scene wraps them in one geometry): one strip per crack, joined in one index list. */
export interface Ribbon {
  /** x, y, z per vertex. */
  position: Float32Array;
  /** -1 on the left edge of its crack and +1 on the right edge: the shader glows the middle. */
  side: Float32Array;
  /** 0 at the root of the crack and 1 at its tip. */
  along: Float32Array;
  /** A number from 0 to 1 per crack, so the cracks do not pulse together. */
  seed: Float32Array;
  index: number[];
}
export function crackRibbon(cracks: readonly Crack[], y = CRACK_Y): Ribbon {
  const verts = cracks.reduce((n, c) => n + c.points.length * 2, 0);
  const position = new Float32Array(verts * 3);
  const side = new Float32Array(verts);
  const along = new Float32Array(verts);
  const seed = new Float32Array(verts);
  const index: number[] = [];
  let v = 0;
  cracks.forEach((crack, k) => {
    const pts = crack.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(n - 1, i + 1)]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (b[1] - a[1]) / len;
      const nz = -(b[0] - a[0]) / len;
      const t = i / (n - 1);
      // Wide at the root, narrow at the tip, with a little unevenness.
      const w = crack.halfWidth * (1 - 0.75 * t) * (1 + 0.15 * Math.sin(i * 2.3 + k));
      for (const s of [-1, 1]) {
        position.set([pts[i]![0] + nx * s * w, y, pts[i]![1] + nz * s * w], v * 3);
        side[v] = s;
        along[v] = t;
        seed[v] = (k * 0.6180339) % 1;
        v++;
      }
      if (i < n - 1) {
        const base = v - 2;
        index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
  });
  return { position, side, along, seed, index };
}
export const ribbonTriangles = (r: Ribbon): number => r.index.length / 3;

/** Everything the Blood Moon draws itself, kept in the spec so the scene and the tests read the same numbers. */
export interface BloodParts {
  platform: PlatformStep[];
  cracks: Crack[];
  /** The pedestal, the middle of the ring, and the ring's radius. */
  ring: { x: number; z: number; radius: number };
}

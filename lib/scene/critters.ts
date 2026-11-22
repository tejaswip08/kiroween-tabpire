// How the small animated things move. Pure functions of time and a seed, so they can be tested.
import { clamp } from './rng';

/** A repeatable number from 0 to 1 for a seed and a counter. */
export function hash01(seed: number, k: number): number {
  const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const bump = (p: number): number => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p) ** 2);
const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

export interface CrowPose {
  /** Height of a hop, in metres (0 when still). */
  hop: number;
  /** Head turn left and right, and nod, in radians. */
  headYaw: number;
  headPitch: number;
}
/**
 * A perched crow: mostly still with a small head bob. Every few seconds it either turns its head to
 * look around or gives a little hop and turns. Every move starts and ends at rest.
 */
export function crowPose(t: number, seed: number): CrowPose {
  const time = finite(t);
  const period = 3.2 + hash01(seed, 1) * 2.6;
  const n = Math.floor(time / period + hash01(seed, 2));
  const phase = (time / period + hash01(seed, 2) - n) * period; // seconds into this slot
  const kind = hash01(seed, n + 10);
  const dir = hash01(seed, n + 40) < 0.5 ? -1 : 1;
  let hop = 0;
  let yaw = 0;
  const idle = 0.05 * Math.sin(time * 1.3 + seed * 3.1);
  if (kind < 0.55) yaw = dir * 0.9 * bump(phase / 1.4);
  else if (kind < 0.8) {
    hop = 0.16 * bump(phase / 0.45);
    yaw = dir * 0.5 * bump(phase / 0.9);
  }
  return { hop, headYaw: yaw + idle, headPitch: 0.12 * Math.sin(time * 0.9 + seed) * (1 - bump(phase / 1.4)) };
}

/** How open the owl's eyes are, from 0 (shut) to 1. A quick blink every few seconds, sometimes two. */
export function owlEyeOpen(t: number, seed = 0): number {
  const time = finite(t);
  const period = 3.4 + hash01(seed, 3) * 2.2;
  const n = Math.floor(time / period);
  const phase = time - n * period;
  const blink = bump(phase / 0.22);
  const second = hash01(seed, n + 5) < 0.35 ? bump((phase - 0.3) / 0.22) : 0;
  return clamp(1 - Math.max(blink, second), 0, 1);
}
/** The owl's slow head turn, in radians. */
export function owlHeadYaw(t: number, seed = 0): number {
  return 0.35 * Math.sin(finite(t) * 0.35 + seed) * Math.sin(finite(t) * 0.11 + seed * 2);
}

/** The cat's tail: a lazy swish, in radians from its resting line. */
export function catTailAngle(t: number): number {
  const time = finite(t);
  return 0.55 * Math.sin(time * 1.9) + 0.2 * Math.sin(time * 0.7 + 1);
}
/** A quick ear twitch now and then, in radians. */
export function catEarTwitch(t: number): number {
  const time = finite(t);
  const n = Math.floor(time / 5.3);
  return hash01(7, n) < 0.6 ? 0.25 * bump((time - n * 5.3) / 0.25) : 0;
}

/** How far down its thread a spider hangs, from `0.35 * drop` to `drop`, bobbing slowly. */
export function spiderLength(t: number, seed: number, drop: number): number {
  const d = Math.max(0, finite(drop));
  return d * (0.675 + 0.325 * Math.sin(finite(t) * 0.55 + seed * 2.1));
}

export const SKELETON_LOOP_S = 14;
/**
 * How far a skeleton has pushed up out of its mound, from 0 (hidden) to 1 (up), in a loop: rest,
 * rise, hold, sink. It starts and ends at 0 and is smooth all the way.
 */
export function skeletonRise(t: number, seed: number): number {
  const loop = SKELETON_LOOP_S;
  const local = (((finite(t) + seed * 4.7) % loop) + loop) % loop;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (local < 3) return 0;
  if (local < 6.5) return ease((local - 3) / 3.5);
  if (local < 9.5) return 1;
  if (local < 13) return ease(1 - (local - 9.5) / 3.5);
  return 0;
}

/** A will-o'-the-wisp drifts in slow loops around its home. Writes into `out`. */
export function wispOffset(t: number, seed: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const time = finite(t);
  out.x = 1.7 * Math.sin(time * (0.21 + 0.05 * hash01(seed, 1)) + seed * 2.3);
  out.y = 0.45 * Math.sin(time * (0.5 + 0.1 * hash01(seed, 2)) + seed);
  out.z = 1.4 * Math.cos(time * (0.17 + 0.05 * hash01(seed, 3)) + seed * 1.7);
  return out;
}
/** A soft flicker for a wisp, from about 0.65 to 1. */
export function wispGlow(t: number, seed: number): number {
  return 0.825 + 0.175 * Math.sin(finite(t) * 2.3 + seed * 5) * Math.sin(finite(t) * 0.9 + seed);
}

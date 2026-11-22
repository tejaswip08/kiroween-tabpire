// Mouse parallax: the camera glides a little toward the pointer. Pure: no three, no browser APIs.
import { clamp } from './rng';

export const PARALLAX = {
  /** Most the camera moves sideways and up or down, in world units (a few degrees of view). */
  maxX: 1.3,
  maxY: 0.45,
  /** Extra turn of the view, as a share of the sideways move. */
  look: 0.35,
  /** How quickly the glide settles (per second). It is a critically damped spring, so it eases in and out. */
  follow: 3.2,
  /** The slower drift back to the normal view. */
  back: 1.1,
  /** The view drifts back when the pointer has not moved for this long. */
  idleSeconds: 2.5,
} as const;

export interface PointerState {
  /** Pixels from the left and top of the window. */
  x: number;
  y: number;
  /** False when the pointer has left the window. */
  known: boolean;
  /** Seconds (same clock as `now`) of the last move. */
  lastMove: number;
}

/** Where the view should go, as -1 to 1 on each axis (right and down are positive). It is 0 when it should rest. */
export function parallaxTarget(p: PointerState, width: number, height: number, now: number, reduced: boolean): { x: number; y: number } {
  if (reduced || !p.known || !(width > 0) || !(height > 0)) return { x: 0, y: 0 };
  if (!(now - p.lastMove <= PARALLAX.idleSeconds)) return { x: 0, y: 0 };
  const nx = Number.isFinite(p.x) ? clamp((p.x / width) * 2 - 1, -1, 1) : 0;
  const ny = Number.isFinite(p.y) ? clamp((p.y / height) * 2 - 1, -1, 1) : 0;
  return { x: nx, y: ny };
}

export interface Spring {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** One step of a critically damped spring toward `target`: no overshoot, and smooth at the start and the end. */
function step(pos: number, vel: number, target: number, dt: number, omega: number): [number, number] {
  const d = pos - target;
  const temp = (vel + omega * d) * dt;
  const e = Math.exp(-omega * dt);
  return [target + (d + temp) * e, (vel - omega * temp) * e];
}

/** Moves the spring toward the target. It follows faster than it returns, so leaving feels calm. */
export function stepParallax(s: Spring, target: { x: number; y: number }, dt: number): void {
  const d = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  const resting = target.x === 0 && target.y === 0;
  const omega = resting ? PARALLAX.back : PARALLAX.follow;
  [s.x, s.vx] = step(s.x, s.vx, target.x, d, omega);
  [s.y, s.vy] = step(s.y, s.vy, target.y, d, omega);
}

/** Camera and look-at offsets for a spring position (from -1 to 1 on each axis). Writes into `out` (position x, y, then target x, y). */
export function parallaxOffsets(x: number, y: number, out: Float64Array | number[]): void {
  const px = clamp(Number.isFinite(x) ? x : 0, -1, 1);
  const py = clamp(Number.isFinite(y) ? y : 0, -1, 1);
  out[0] = px * PARALLAX.maxX;
  out[1] = -py * PARALLAX.maxY;
  out[2] = px * PARALLAX.maxX * (1 + PARALLAX.look);
  out[3] = -py * PARALLAX.maxY * 0.5;
}

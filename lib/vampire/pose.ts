// Vampire poses as pure functions of state, time and cursor direction.
// The model has no skeleton, so every pose moves or reshapes the whole body.
import type { VampireState } from '../hunger';
import { approach } from '../scene/meaning';
import { clamp, lerp } from '../scene/rng';
import { VAMPIRE } from './rig';

export { approach };

export interface Pose {
  /** Sideways and up/down offsets, in model heights. */
  x: number;
  y: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  /** Bend of the body: positive hunches forward, negative leans back. */
  bend: number;
  /** Red glow from 0 to 1. */
  glow: number;
  /** 0 standing, 1 lying in the coffin. */
  lying: number;
  /** 0 eyes open, 1 closed. */
  eyesClosed: number;
  /** Breath from -1 to 1. */
  breath: number;
}

export const POSE_KEYS = [
  'x', 'y', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ', 'bend', 'glow', 'lying', 'eyesClosed', 'breath',
] as const satisfies readonly (keyof Pose)[];

/** Limits every pose value stays within. */
export const POSE_LIMITS = {
  offset: 0.5,
  rot: Math.PI,
  scaleMin: 0.8,
  scaleMax: 1.2,
  bend: 1,
} as const;

const DEG = Math.PI / 180;
export const LOOK_LIMIT = { yaw: 25 * DEG, pitch: 12 * DEG } as const;

export type Look = { yaw: number; pitch: number };
export const NO_LOOK: Look = { yaw: 0, pitch: 0 };

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

/**
 * Direction of the cursor from the portrait: `dx` to the right and `dy` downward, each
 * in portrait sizes (so 1 is one portrait away). Smoothly limited to 25 degrees sideways
 * and 12 degrees up or down.
 */
export function lookAngles(dx: number, dy: number): Look {
  return {
    yaw: LOOK_LIMIT.yaw * Math.tanh(finite(dx) * 0.7),
    pitch: LOOK_LIMIT.pitch * Math.tanh(finite(dy) * 0.7),
  };
}

const base = (): Pose => ({
  x: 0, y: 0, rotX: 0, rotY: VAMPIRE.facingYaw, rotZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1, bend: 0, glow: 0, lying: 0, eyesClosed: 0, breath: 0,
});

/**
 * The resting pose for a state, with its motion. `seed` (from the tab id) gives each
 * vampire its own start time and speed. With `reduced`, time stands still and the
 * vampire holds its state pose.
 */
export function statePose(state: VampireState, time: number, seed: number, look: Look = NO_LOOK, reduced = false): Pose {
  const s = finite(seed);
  const frac = (s * 0.6180339887) % 1;
  const phase = Math.abs(frac) * Math.PI * 2;
  const speed = 1 + 0.15 * Math.abs(((s * 0.7548776662) % 1));
  const t = reduced ? 0 : finite(time) * speed;
  const p = base();

  switch (state) {
    case 'awake': {
      const b = reduced ? 0 : Math.sin((2 * Math.PI * t) / 4 + phase);
      p.breath = b;
      p.scaleY = 1 + 0.0125 * (1 + b);
      p.scaleX = p.scaleZ = 1 - 0.006 * (1 + b);
      p.rotY += reduced ? 0 : look.yaw;
      p.rotX = reduced ? 0 : look.pitch;
      break;
    }
    case 'starving': {
      const w = (2 * Math.PI * t) / 3.2 + phase;
      p.bend = 0.55;
      p.y = -0.015;
      p.x = 0.1 * Math.sin(w);
      // Turn toward the way it is walking, quickly at each end.
      p.rotY += 0.6 * Math.tanh(3 * Math.cos(w));
      p.rotX = 0.1;
      p.glow = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 1.2 + phase);
      p.breath = Math.sin((2 * Math.PI * t) / 2.4 + phase);
      p.scaleY = 0.98 + 0.01 * p.breath;
      break;
    }
    case 'protected': {
      p.bend = -0.4;
      p.rotX = -14 * DEG;
      p.rotZ = 0.025 * Math.sin(t * 38 + phase);
      p.x = 0.004 * Math.sin(t * 47 + phase * 2);
      p.rotY += 0.02 * Math.sin(t * 31 + phase * 3);
      break;
    }
    case 'asleep': {
      const b = reduced ? 0 : Math.sin((2 * Math.PI * t) / 5 + phase);
      p.lying = 1;
      p.eyesClosed = 1;
      p.breath = b;
      p.scaleY = 1 + 0.012 * b;
      break;
    }
  }
  return p;
}

/** Mix of two poses. `k` is clamped to 0..1. At 0 it is `a`, at 1 it is `b`. */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const kk = clamp(finite(k), 0, 1);
  const out = base();
  for (const key of POSE_KEYS) out[key] = kk <= 0 ? a[key] : kk >= 1 ? b[key] : lerp(a[key], b[key], kk);
  return out;
}

/** Moves a displayed pose toward a target without overshoot (frame-rate independent). */
export function approachPose(current: Pose, target: Pose, dt: number, rate: number): Pose {
  const out = base();
  for (const key of POSE_KEYS) out[key] = approach(current[key], target[key], dt, rate);
  return out;
}

/** Time for the displayed pose to settle after a state change, in seconds. */
export const BLEND_SECONDS = 0.3;
/** Approach rate that settles within about BLEND_SECONDS. */
export const BLEND_RATE = 4 / BLEND_SECONDS;

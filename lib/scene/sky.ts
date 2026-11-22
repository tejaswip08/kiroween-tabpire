// Moon, clouds and witch paths. Pure. Angles are in degrees.
import { CAMERA_REST, add, cameraAt, cross, directionAt, fovForAspect, normalize, scale, type Vec3 } from './camera';
import { clamp, lerp } from './rng';

export const MOON = {
  /** Angular radius of the red disc. */
  discDeg: 4.3,
  /** Angular radius of the glow around it. */
  haloDeg: 8.5,
} as const;

/** Where the moon should appear on screen (0 to 1, y from the top). */
export function moonTarget(aspect: number): { x: number; y: number } {
  const k = clamp((aspect - 0.6) / 0.9, 0, 1);
  return { x: lerp(0.72, 0.82, k), y: lerp(0.11, 0.17, k) };
}

/** Direction of the moon from the camera's rest position, for a window shape. */
export function moonDirection(aspect: number): Vec3 {
  const t = moonTarget(aspect);
  return directionAt(t.x, t.y, cameraAt(0, aspect, true));
}

/** Radius of the moon's disc and halo as a fraction of the window height. */
export function moonScreenRadius(aspect: number): { disc: number; halo: number } {
  const tanH = Math.tan((fovForAspect(aspect) * Math.PI) / 360);
  const r = (deg: number) => Math.tan((deg * Math.PI) / 180) / tanH / 2;
  return { disc: r(MOON.discDeg), halo: r(MOON.haloDeg) };
}

/** Right and up directions on the sky around a direction (a tangent plane). */
export function tangentBasis(dir: Vec3): { right: Vec3; up: Vec3 } {
  const right = normalize(cross(dir, [0, 1, 0]));
  const up = cross(right, dir);
  return { right, up };
}

/** The direction u degrees right and v degrees up from the moon. */
export function directionFromMoon(moonDir: Vec3, uDeg: number, vDeg: number): Vec3 {
  const { right, up } = tangentBasis(moonDir);
  const tu = Math.tan((uDeg * Math.PI) / 180);
  const tv = Math.tan((vDeg * Math.PI) / 180);
  return normalize(add(add(moonDir, scale(right, tu)), scale(up, tv)));
}

// ---------- clouds ----------
export interface CloudEllipse {
  u: number;
  v: number;
  /** Half width in degrees. */
  a: number;
  /** Half height in degrees. */
  b: number;
  lane: number;
}
export interface Lane {
  /** Vertical offset from the moon's centre. */
  v: number;
  /** Degrees per second. Negative moves left. */
  speed: number;
  /** The lane's clouds drift between these two positions and wrap. They fade at both ends, so the wrap is never seen. */
  uMin: number;
  uMax: number;
  clouds: { u0: number; a: number; b: number }[];
}
/** The moon's halo plus its largest pulse (20 percent): nothing may come closer than this. */
export const MOON_KEEP_OUT_DEG = MOON.haloDeg * 1.2;
/**
 * Three lanes that span the whole sky, above and below the moon, and three lanes that stay in
 * the sky to the left of the moon, at its height. Every cloud is kept at least the halo's
 * largest size away from the moon's centre, whatever the time.
 */
export const CLOUD_LANES: readonly Lane[] = [
  { v: -18, speed: 0.3, uMin: -60, uMax: 60, clouds: [{ u0: -40, a: 7, b: 1.9 }, { u0: 5, a: 6, b: 1.6 }, { u0: 45, a: 8, b: 2.0 }] },
  { v: -23.5, speed: -0.22, uMin: -60, uMax: 60, clouds: [{ u0: -25, a: 8, b: 2.0 }, { u0: 30, a: 7, b: 1.8 }] },
  { v: 19, speed: 0.25, uMin: -60, uMax: 60, clouds: [{ u0: -45, a: 8, b: 2.0 }, { u0: 10, a: 6.5, b: 1.7 }, { u0: 50, a: 7, b: 1.8 }] },
  { v: 2, speed: 0.32, uMin: -80, uMax: -27, clouds: [{ u0: -70, a: 7, b: 1.8 }, { u0: -45, a: 6, b: 1.6 }] },
  { v: 9.5, speed: -0.26, uMin: -80, uMax: -27, clouds: [{ u0: -62, a: 8, b: 2.0 }, { u0: -38, a: 5.5, b: 1.5 }] },
  { v: -7, speed: 0.22, uMin: -80, uMax: -27, clouds: [{ u0: -66, a: 6, b: 1.6 }, { u0: -40, a: 7, b: 1.8 }] },
];
/** Position of a cloud along its lane at time t, wrapped between the lane's ends. The scene shader repeats this. */
export function cloudU(u0: number, speed: number, t: number, uMin: number, uMax: number): number {
  const span = uMax - uMin;
  const raw = u0 - uMin + speed * t;
  return uMin + (((raw % span) + span) % span);
}
/** 0 at both ends of a lane and 1 in the middle, so a cloud fades in and out where it wraps. */
export function cloudFade(u: number, uMin: number, uMax: number): number {
  const f = clamp((u - uMin) / (uMax - uMin), 0, 1);
  const s = (x: number) => x * x * (3 - 2 * x);
  return s(clamp(f / 0.14, 0, 1)) * (1 - s(clamp((f - 0.86) / 0.14, 0, 1)));
}
export function cloudsAt(t: number): CloudEllipse[] {
  const out: CloudEllipse[] = [];
  CLOUD_LANES.forEach((lane, li) => {
    for (const c of lane.clouds) {
      out.push({ u: cloudU(c.u0, lane.speed, t, lane.uMin, lane.uMax), v: lane.v, a: c.a, b: c.b, lane: li });
    }
  });
  return out;
}
export interface CloudPuff {
  lane: number;
  u0: number;
  speed: number;
  v: number;
  uMin: number;
  uMax: number;
  /** Offset along the lane and up or down from the lane, in degrees. */
  offU: number;
  offV: number;
  /** Half width of the puff in degrees. Its half height is `radius * ratio`. */
  radius: number;
  ratio: number;
  shade: number;
}
/** Puffs per cloud. */
export const PUFFS_PER_CLOUD = 9;
/**
 * Nine soft puffs for every cloud: a row of broad flat puffs for the base and rounder humps
 * above them, tallest in the middle. The scene draws them overlapping into one cloud shape.
 */
export function cloudPuffs(): CloudPuff[] {
  const out: CloudPuff[] = [];
  CLOUD_LANES.forEach((lane, li) => {
    lane.clouds.forEach((c, ci) => {
      for (let k = 0; k < PUFFS_PER_CLOUD; k++) {
        const f = k / (PUFFS_PER_CLOUD - 1) - 0.5;
        const hump = Math.cos(f * Math.PI);
        const wob = Math.sin((li * 7 + ci * 3 + k) * 1.7);
        const base = k % 3 === 0;
        out.push({
          lane: li,
          u0: c.u0,
          speed: lane.speed,
          v: lane.v,
          uMin: lane.uMin,
          uMax: lane.uMax,
          offU: f * 2 * c.a * 0.85 + wob * 0.3,
          offV: base ? -0.35 * c.b : (0.12 + 0.55 * hump) * c.b + wob * 0.1 * c.b,
          radius: base ? c.b * (1.5 + 0.5 * hump) : c.b * (0.95 + 0.7 * hump),
          ratio: base ? 0.5 : 0.8,
          shade: (wob + 1) / 2,
        });
      }
    });
  });
  return out;
}
export const CLOUD_COUNT = CLOUD_LANES.reduce((n, l) => n + l.clouds.length, 0);
/** Smallest distance from the moon's centre to a point on the cloud's outline. */
export function cloudDistanceToMoon(c: CloudEllipse): number {
  let min = Infinity;
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * 2 * Math.PI;
    const d = Math.hypot(c.u + c.a * Math.cos(ang), c.v + c.b * Math.sin(ang));
    if (d < min) min = d;
  }
  return min;
}
// ---------- witch ----------

export const WITCH_FLIGHT_S = 36;

/**
 * Position on the sky, relative to the moon, for a flight from 0 to 1.
 * She crosses in front of the moon once, halfway through.
 */
export function witchAt(progress: number): { u: number; v: number; tilt: number } {
  return witchAtInto(progress, { u: 0, v: 0, tilt: 0 });
}
/** Same as `witchAt`, but writes into `out`, so the frame loop creates nothing. */
export function witchAtInto(progress: number, out: { u: number; v: number; tilt: number }): { u: number; v: number; tilt: number } {
  const p = clamp(progress, 0, 1);
  out.u = -58 + 116 * p;
  out.v = (p - 0.5) * 30 + 1.3 * Math.sin(p * 18);
  out.tilt = Math.atan2(30 + 1.3 * 18 * Math.cos(p * 18), 116) * 0.6;
  return out;
}

/** Sky position of the camera's rest view, for the sky dome. */
export const SKY_REST_POSITION = CAMERA_REST.position;

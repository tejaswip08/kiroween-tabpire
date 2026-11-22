// Camera rig, drift and projection maths. Pure: no three.
import { clamp } from './rng';

export type Vec3 = readonly [number, number, number];

export const CAMERA_REST = {
  position: [0.5, 3.8, 16] as Vec3,
  // Looks down the path, tilted down about 5 degrees, so the ground is full of things.
  target: [0.5, 1.5, -8] as Vec3,
};

/** Vertical field of view at 16:9. */
export const BASE_FOV = 40;
export const DRIFT_PERIOD_S = 60;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface CameraState {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view in degrees. */
  fov: number;
  aspect: number;
}

/** Wider view for narrower windows, so the scene is not cut off. */
export function fovForAspect(aspect: number): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.78;
  return BASE_FOV * Math.pow(clamp(1.78 / a, 1, 1.9), 0.6);
}

/**
 * A slow drift on one closed ellipse. It starts and ends at the same place
 * every DRIFT_PERIOD_S seconds and never jumps.
 */
export function cameraDrift(t: number): { position: Vec3; target: Vec3 } {
  const w = (2 * Math.PI * t) / DRIFT_PERIOD_S;
  const position: Vec3 = [0.55 * Math.sin(w), 0.22 * Math.sin(w + 1.1), 0.4 * Math.sin(w + 2.2)];
  return { position, target: scale(position, 1 / 3) };
}

/**
 * Same numbers as `cameraDrift`, written into `out` (position x, y, z, then target x, y, z),
 * so the frame loop creates nothing. With `reduced` the drift stays at its start.
 */
export function cameraDriftInto(t: number, reduced: boolean, out: Float64Array | number[]): void {
  const w = reduced ? 0 : (2 * Math.PI * t) / DRIFT_PERIOD_S;
  const x = 0.55 * Math.sin(w);
  const y = 0.22 * Math.sin(w + 1.1);
  const z = 0.4 * Math.sin(w + 2.2);
  out[0] = CAMERA_REST.position[0] + x;
  out[1] = CAMERA_REST.position[1] + y;
  out[2] = CAMERA_REST.position[2] + z;
  out[3] = CAMERA_REST.target[0] + x / 3;
  out[4] = CAMERA_REST.target[1] + y / 3;
  out[5] = CAMERA_REST.target[2] + z / 3;
}
export function cameraAt(t: number, aspect: number, reduced = false): CameraState {
  const d = cameraDrift(reduced ? 0 : t);
  return {
    position: add(CAMERA_REST.position, d.position),
    target: add(CAMERA_REST.target, d.target),
    fov: fovForAspect(aspect),
    aspect,
  };
}

/** Camera directions: forward, right and up. */
export function basis(cam: CameraState): { f: Vec3; r: Vec3; u: Vec3 } {
  const f = normalize(sub(cam.target, cam.position));
  const r = normalize(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { f, r, u };
}

export interface Projected {
  /** 0 is the left edge, 1 the right edge. */
  x: number;
  /** 0 is the top edge, 1 the bottom edge. */
  y: number;
  depth: number;
}

/** Where a point in the world appears on screen, or null if it is behind the camera. */
export function project(point: Vec3, cam: CameraState): Projected | null {
  const { f, r, u } = basis(cam);
  const rel = sub(point, cam.position);
  const depth = dot(rel, f);
  if (depth <= 0.01) return null;
  const tanH = Math.tan((cam.fov * Math.PI) / 360);
  const ndcX = dot(rel, r) / (depth * tanH * cam.aspect);
  const ndcY = dot(rel, u) / (depth * tanH);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2, depth };
}

/** Where a direction at infinity (the moon, the clouds) appears on screen. */
export function projectDirection(dir: Vec3, cam: CameraState): Projected | null {
  const { f, r, u } = basis(cam);
  const depth = dot(dir, f);
  if (depth <= 0.001) return null;
  const tanH = Math.tan((cam.fov * Math.PI) / 360);
  const ndcX = dot(dir, r) / (depth * tanH * cam.aspect);
  const ndcY = dot(dir, u) / (depth * tanH);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2, depth };
}

/** Inverse of `projectDirection`: the direction that appears at a screen position. */
export function directionAt(x: number, y: number, cam: CameraState): Vec3 {
  const { f, r, u } = basis(cam);
  const tanH = Math.tan((cam.fov * Math.PI) / 360);
  const ndcX = 2 * x - 1;
  const ndcY = 1 - 2 * y;
  return normalize(add(add(f, scale(r, ndcX * tanH * cam.aspect)), scale(u, ndcY * tanH)));
}

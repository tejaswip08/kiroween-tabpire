// The Crypt's soft round clouds, placed as the first prototype placed them (../tabpire, components/three/SkyLife.tsx): a dark violet
// layer high above the moon and a pink layer low near the horizon, drifting right to left and wrapping around. Pure: no three.
// The prototype had its own camera, so each cloud is moved to where it showed on screen there (at a 16:10 window), at the same
// distance from this scene's camera, and scaled so it is the same size on screen. The pink layer sits just above this scene's horizon.
// Coordinates are world coordinates (x right, y up, z toward the camera).
import { cameraAt, directionAt, project, type CameraState } from './camera';
import { moonScreenRadius, moonTarget } from './sky';

/** The prototype's camera. */
const PROTO_CAM: CameraState = { position: [0, 3.4, 22], target: [0, 3.1, -1], fov: 34, aspect: 16 / 10 };
/** The prototype's clouds: start x, y, z, scale, speed (units per second, right to left) and colour. */
export const PROTO_CLOUDS: readonly (readonly [number, number, number, number, number, string])[] = [
  [30, 20.5, -42, 2.4, 0.35, '#4a2478'],
  [-12, 21, -42, 2.2, 0.28, '#4f2780'],
  [8, 19.5, -40, 2, 0.45, '#5a2c88'],
  [-30, 20, -41, 2.3, 0.4, '#6b3394'],
  [18, 5.8, -34, 1.6, 0.6, '#c45a9e'],
  [-20, 5.5, -34, 1.5, 0.7, '#b24b93'],
];
/** The puffs of one cloud: x, y, z and radius. A billowy top over a flat-ish bottom. */
export const CLOUD_BLOBS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 1.2], [1.25, -0.1, 0.15, 1], [-1.25, -0.15, 0.05, 0.98], [2.35, -0.3, 0, 0.72], [-2.3, -0.32, -0.05, 0.7],
  [0.55, 0.62, -0.1, 0.92], [-0.6, 0.5, 0.15, 0.82], [1.5, 0.42, -0.2, 0.66], [-1.6, 0.3, -0.2, 0.6], [0.1, 1.05, -0.25, 0.6],
];
/**
 * Screen height (from the top, at 16:10) of the pink layer: up in the sky between the search box and the chips row, well above the
 * fence and the mausoleum roof. That is the moon's height, so this layer drifts only in the sky left of the moon (`lowBand`).
 */
export const LOW_LAYER_Y = 0.3;
/** The pink layer is drawn a little smaller than the prototype's. */
export const LOW_LAYER_SIZE = 0.75;
/** Screen x (16:10) where the pink layer's band starts, off the left edge, and the gap it keeps from the moon's disc. */
export const LOW_BAND_START = -0.12;
export const LOW_MOON_GAP = 0.03;
/** Half width of a cloud in its own units (before `scale`): its widest puff, times the 1.25 stretch the renderer uses. */
export const CLOUD_HALF_W = Math.max(...CLOUD_BLOBS.map((b) => Math.abs(b[0]) + b[3])) * 1.25;
/** The prototype wrapped its clouds around this wide a band of x. */
export const PROTO_SPAN = 90;

export interface CryptCloud {
  /** World position of the cloud's centre when its prototype x is 0. */
  x: number;
  y: number;
  z: number;
  /** World units this cloud moves for one prototype unit of x (the two cameras see different widths). */
  k: number;
  /** The prototype's start x and speed: its x at time t is `wrapX(x0 - t * speed)`. */
  x0: number;
  speed: number;
  /** Size of the cloud, the prototype's scale times `k`. */
  scale: number;
  color: string;
  /** Pink layer only: the world x band it drifts in (its centre stays inside, so the cloud never reaches the moon). */
  band?: { min: number; max: number };
}
/** The prototype's x of a cloud, wrapped into its band. */
export const wrapX = (x: number): number => ((((x + PROTO_SPAN / 2) % PROTO_SPAN) + PROTO_SPAN) % PROTO_SPAN) - PROTO_SPAN / 2;
/** Where a cloud is (world x) at time t. */
export function cloudX(c: CryptCloud, t: number): number {
  if (!c.band) return c.x + wrapX(c.x0 - t * c.speed) * c.k;
  const span = c.band.max - c.band.min;
  const start = ((c.x0 + PROTO_SPAN / 2) / PROTO_SPAN) * span;
  const raw = start - t * c.speed * c.k;
  return c.band.min + (((raw % span) + span) % span);
}
/** Size factor (0 to 1) of a cloud at time t: a pink cloud forms near the moon end of its band and fades off the left end. */
export function cloudFade(c: CryptCloud, t: number): number {
  if (!c.band) return 1;
  const f = (cloudX(c, t) - c.band.min) / (c.band.max - c.band.min);
  const s = (v: number) => { const q = Math.min(1, Math.max(0, v)); return q * q * (3 - 2 * q); };
  return s(f / 0.12) * s((1 - f) / 0.25);
}

export function cryptClouds(): CryptCloud[] {
  const cam = cameraAt(0, 16 / 10, true);
  const tanHere = Math.tan((cam.fov * Math.PI) / 360);
  const tanThere = Math.tan((PROTO_CAM.fov * Math.PI) / 360);
  return PROTO_CLOUDS.map(([x0, y, z, s, speed, color]) => {
    const p = project([0, y, z], PROTO_CAM)!;
    const low = y < 10;
    const d = directionAt(p.x, low ? LOW_LAYER_Y : p.y, cam);
    const dist = Math.hypot(0 - PROTO_CAM.position[0], y - PROTO_CAM.position[1], z - PROTO_CAM.position[2]);
    const k = tanHere / tanThere;
    const scale = s * k * (low ? LOW_LAYER_SIZE : 1);
    let band: CryptCloud['band'];
    if (low) {
      // World x at this cloud's depth for a screen x, along the layer's height.
      const worldX = (sx: number) => { const q = directionAt(sx, LOW_LAYER_Y, cam); return cam.position[0] + (q[0] / q[2]) * (d[2] * dist); };
      const moon = moonTarget(cam.aspect);
      const edge = moon.x - moonScreenRadius(cam.aspect).disc / cam.aspect - LOW_MOON_GAP;
      band = { min: worldX(LOW_BAND_START) - CLOUD_HALF_W * scale, max: worldX(edge) - CLOUD_HALF_W * scale };
    }
    return {
      x: cam.position[0] + d[0] * dist,
      y: cam.position[1] + d[1] * dist,
      z: cam.position[2] + d[2] * dist,
      k,
      x0,
      speed,
      scale,
      color,
      ...(band ? { band } : {}),
    };
  });
}
/** Segments of each smooth puff (around and from top to bottom). */
export const PUFF_SEGMENTS = [16, 10] as const;
/** Triangles of one puff and of every cloud together; the clouds are two draw calls (lit tops and darker undersides). */
export const PUFF_TRIS = PUFF_SEGMENTS[0] * PUFF_SEGMENTS[1] * 2;
export const CLOUD_CALLS = 2;
export const cloudTriangles = (): number => PROTO_CLOUDS.length * CLOUD_BLOBS.length * PUFF_TRIS;

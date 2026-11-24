// The old haunted house on the dark hill at the right edge of the Pumpkin Patch. Pure numbers: where it stands, how big the
// hill is, and the sizes the shapes (`houseBuild.ts`) are drawn from, so the tests can check that nothing floats.
import { cameraAt, project } from '../camera';
import { moonScreenRadiusScaled } from '../sky';
import { FRAME_WINDOWS, MOON_SCALE, moonSpot } from './autumn';

/** Where the house stands: the middle of its hill on the ground, turned a little toward the camera, and its overall scale. */
export const HOUSE = { x: 26, z: -25, rotY: -0.4, scale: 0.65 };
/** The hill: half an ellipsoid sitting on the ground (y = 0), wide and low, so the house stands on a rise. */
export const HILL = { rx: 7.2, rz: 5.6, h: 1.25 };
/** The house floor (in the house's own units, before scale) sits this high on the hill, a little below its crown. */
export const FLOOR_Y = 0.85;
/** The stone footing under the walls goes down into the hill to this height. */
export const FOOTING_Y = 0.25;

/** The measurements of the house (local units, floor at y = 0, front toward +z). */
export const PLAN = {
  width: 3.0,
  depth: 2.4,
  wallH: 4.4,
  tower: { x: 2.0, w: 1.3, h: 5.0, roofH: 2.2 },
  /** Roof rise over half the width: steep. */
  roofRise: 2.2,
  overhang: 0.25,
  porch: { x: 0.55, w: 1.7, d: 1.1, h: 0.25 },
} as const;

/** The boxes the house is made of (local units, x0 x1 y0 y1 z0 z1), tall roof parts included: the main body with its roof and chimney, the tower, the porch. */
export const PARTS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-PLAN.width / 2 - PLAN.overhang, PLAN.width / 2 + PLAN.overhang, -(FLOOR_Y - FOOTING_Y), PLAN.wallH + PLAN.roofRise + 0.9, -PLAN.depth / 2 - 0.3, PLAN.depth / 2 + 0.3],
  [PLAN.tower.x - PLAN.tower.w / 2, PLAN.tower.x + PLAN.tower.w / 2, -(FLOOR_Y - FOOTING_Y), PLAN.tower.h + PLAN.tower.roofH, -PLAN.tower.w / 2, PLAN.tower.w / 2],
  [PLAN.porch.x - PLAN.porch.w / 2, PLAN.porch.x + PLAN.porch.w / 2, -(FLOOR_Y - FOOTING_Y), PLAN.wallH * 0.5, PLAN.depth / 2, PLAN.depth / 2 + PLAN.porch.d],
];
/** The footprint of everything that stands on the hill, in local units. */
export const FOOTPRINT = {
  x0: -PLAN.width / 2 - 0.1,
  x1: PLAN.tower.x + PLAN.tower.w / 2,
  z0: -PLAN.depth / 2,
  z1: PLAN.depth / 2 + PLAN.porch.d,
};

/** Height of the hill's surface at a point of the hill (local to the hill centre, before the house scale), 0 outside it. */
export function hillHeightAt(x: number, z: number): number {
  const u = (x / HILL.rx) ** 2 + (z / HILL.rz) ** 2;
  return u >= 1 ? 0 : HILL.h * Math.sqrt(1 - u);
}

/** World position of a point of the house given in local units. */
export function houseToWorld(lx: number, ly: number, lz: number): [number, number, number] {
  const s = HOUSE.scale;
  const c = Math.cos(HOUSE.rotY);
  const n = Math.sin(HOUSE.rotY);
  const x = lx * s;
  const z = lz * s;
  return [HOUSE.x + x * c + z * n, FLOOR_Y * s + ly * s, HOUSE.z - x * n + z * c];
}

/** What each part of the house covers on screen (fractions of the window) at an aspect. Null when a corner is behind the camera. */
export function houseOnScreen(aspect: number): { x0: number; x1: number; y0: number; y1: number }[] | null {
  const cam = cameraAt(0, aspect, true);
  const out: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const [x0, x1, y0, y1, z0, z1] of PARTS) {
    const q = [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z) => project(houseToWorld(x, y, z), cam))));
    if (q.some((p) => p === null)) return null;
    const xs = q.map((p) => p!.x);
    const ys = q.map((p) => p!.y);
    out.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  return out;
}

/** True when a part of the house, in some window, touches the moon's disc (plus a small gap). */
export function houseCoversMoon(gap = 0.02): boolean {
  for (const [w, h] of FRAME_WINDOWS) {
    const a = w / h;
    const parts = houseOnScreen(a);
    if (!parts) continue;
    const m = moonSpot(a);
    const r = moonScreenRadiusScaled(a, MOON_SCALE).disc + gap;
    for (const s of parts) {
      const dx = Math.max(s.x0 - m.x, 0, m.x - s.x1) * a;
      const dy = Math.max(s.y0 - m.y, 0, m.y - s.y1);
      if (Math.hypot(dx, dy) < r) return true;
    }
  }
  return false;
}

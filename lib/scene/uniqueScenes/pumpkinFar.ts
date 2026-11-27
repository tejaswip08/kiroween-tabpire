// The Pumpkin Patch's far scenery and dusk clouds. Pure and seeded: where every far thing stands, how big it is, and where
// the clouds sit on screen. The shapes are built by `entrypoints/newtab/layers/scene/themes/pumpkinFarBuild.ts`.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16). The ground ends at z = -100.
import { cameraAt, directionAt, project, type Vec3 } from '../camera';
import { moonScreenRadiusScaled } from '../sky';
import { mulberry32 } from '../rng';
import type { Footprint } from '../layout';
import { MOON_SCALE, moonSpot } from './autumn';

/** Its own random stream, so the rest of the scene does not move. */
export const FAR_SEED = 7333;

/** A low hill on the horizon: half an ellipsoid on the ground. */
export interface FarHill { x: number; z: number; rx: number; rz: number; h: number }
/** A building or a tree: where it stands, its turn, its size, and a lean (radians, about z) for crooked ones. */
export interface FarThing { x: number; z: number; rotY: number; scale: number; lean: number }
/** A dead tree, and how many crows sit on it. */
export interface DeadTree extends FarThing { crows: number }

export interface PumpkinFar {
  /** Far back: rolling hills, two haunted farmhouses, a church steeple, a water tower and a farm village. */
  hills: FarHill[];
  farmhouses: FarThing[];
  steeple: FarThing;
  waterTower: FarThing;
  village: FarThing[];
  /** Middle back: bare twisted trees (some with crows), autumn trees and scarecrows on poles. */
  deadTrees: DeadTree[];
  autumnTrees: FarThing[];
  scarecrows: FarThing[];
  /** Near the field edges: a broken fence, a hay wagon, stacked hay, an old well and a small shed. */
  fence: FarThing[];
  wagon: FarThing;
  hayStacks: FarThing[];
  well: FarThing;
  shed: FarThing;
  /** Ground mist bands between the layers: depth (z), width, height, strength. */
  mist: { z: number; x: number; w: number; h: number; alpha: number }[];
}

/** Heights (before scale) of the shapes, for the screen checks. Matches `pumpkinFarBuild.ts`. */
export const FAR_HEIGHT = {
  farmhouse: 4.6,
  steeple: 9.5,
  waterTower: 8.2,
  village: 3.2,
  deadTree: 6,
  autumnTree: 5.2,
  scarecrow: 3.2,
  fence: 1.1,
  wagon: 2.2,
  hayStack: 1.6,
  well: 2.4,
  shed: 3,
} as const;

/** Half sizes on the ground (before scale), for the footprints. */
export const FAR_HALF = {
  farmhouse: 2.4, steeple: 1.4, waterTower: 1.6, village: 1.6, deadTree: 0.6, autumnTree: 1.4, scarecrow: 0.6,
  fence: 1.2, wagon: 2.2, hayStack: 1.1, well: 1.0, shed: 1.6,
} as const;

/** Upper bounds of what the far scenery draws (checked against the real shapes in `tests/ui/pumpkinFar.test.tsx`). */
export const FAR_PARTS = {
  /** Hills, far buildings, mid trees, scarecrows, near props and mist. */
  tris: 4100,
  /** Hills and one-off buildings (one merged mesh), their lit windows, then instanced: village houses, village windows, dead trees, crows, autumn trees, scarecrows, fence, hay; and the mist. */
  calls: 11,
  /** The dusk clouds: two triangles per puff. */
  cloudTris: 2 * 38,
  cloudCalls: 1,
};

export function buildPumpkinFar(seed: number): PumpkinFar {
  const rng = mulberry32(FAR_SEED + seed);
  const j = (a: number) => (rng() * 2 - 1) * a;
  const thing = (x: number, z: number, scale: number, rotY = 0, lean = 0): FarThing => ({ x: x + j(0.4), z: z + j(0.4), rotY: rotY + j(0.15), scale: scale * (1 + j(0.06)), lean });

  const hills: FarHill[] = [
    { x: -62, z: -94, rx: 26, rz: 9, h: 7.5 },
    { x: -30, z: -97, rx: 22, rz: 8, h: 6.5 },
    { x: -6, z: -95, rx: 18, rz: 7, h: 5 },
    { x: 16, z: -96, rx: 20, rz: 8, h: 5.5 },
    { x: 40, z: -94, rx: 22, rz: 8, h: 3 },
    { x: 66, z: -95, rx: 24, rz: 8, h: 2.5 },
  ];
  const farmhouses = [thing(-36, -84, 1.1, 0.35, -0.05), thing(28, -82, 0.95, -0.4, 0.06)];
  const steeple = thing(-54, -88, 1.05, 0.2, 0.02);
  const waterTower = thing(30, -76, 0.95, 0.3);
  // The far farm village: small houses between the barn and the windmill and on the left, behind the corn.
  const village: FarThing[] = [];
  for (const [x0, x1, z0, n] of [[-2, 14, -86, 6], [-28, -18, -80, 3]] as const) {
    for (let i = 0; i < n; i++) village.push(thing(x0 + ((x1 - x0) * (i + 0.5)) / n, z0 + j(3), 0.9 + rng() * 0.35, j(0.6), j(0.04)));
  }

  // Middle back: bare trees of different heights (left, between the barn and the windmill, right), autumn trees and scarecrows.
  const deadSpots: [number, number, number][] = [[-36, -54, 1.45], [-27, -60, 1.1], [-44, -64, 1.25], [3.5, -58, 0.85], [7.5, -62, 0.7], [22, -56, 1.2], [31, -62, 0.95]];
  const deadTrees: DeadTree[] = deadSpots.map(([x, z, s], i) => ({ ...thing(x, z, s, rng() * Math.PI * 2, j(0.08)), crows: i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0 }));
  const autumnTrees = [thing(-21, -52, 0.95), thing(-49, -58, 1.1), thing(0.5, -66, 0.75), thing(26, -64, 0.9), thing(15, -64, 0.8)];
  const scarecrows = [thing(-30, -44, 1, 0.3, 0.05), thing(5.5, -48, 0.9, -0.2, -0.06), thing(26, -46, 1, -0.5, 0.04)];

  // Near the field edges: a broken fence along the back of each corn field, a hay wagon and a well on the left, a shed and hay on the right.
  const fence: FarThing[] = [];
  for (let i = 0; i < 6; i++) if (i !== 3) fence.push(thing(-31 + i * 2.5, -36, 1, j(0.1), i % 2 ? 0.12 : -0.08));
  for (let i = 0; i < 6; i++) if (i !== 2) fence.push(thing(21 + i * 2.5, -36.5, 1, j(0.1), i % 2 ? -0.1 : 0.07));
  const wagon = thing(-23, -40, 1, 0.5);
  const well = thing(-33, -40, 1);
  const shed = thing(33, -41, 1, -0.5);
  const hayStacks = [thing(25, -40, 1, 0.3), thing(27.5, -41.5, 0.9, -0.2), thing(-27, -42.5, 0.95, 0.6)];

  const mist = [
    { z: -42, x: 0, w: 140, h: 3.2, alpha: 0.22 },
    { z: -66, x: 0, w: 180, h: 5, alpha: 0.3 },
    { z: -90, x: 0, w: 220, h: 7, alpha: 0.38 },
  ];
  return { hills, farmhouses, steeple, waterTower, village, deadTrees, autumnTrees, scarecrows, fence, wagon, hayStacks, well, shed, mist };
}

/** Every far thing with its kind, for the checks and the footprints. */
export function farThings(far: PumpkinFar): { kind: keyof typeof FAR_HEIGHT; t: FarThing }[] {
  return [
    ...far.farmhouses.map((t) => ({ kind: 'farmhouse' as const, t })),
    { kind: 'steeple', t: far.steeple },
    { kind: 'waterTower', t: far.waterTower },
    ...far.village.map((t) => ({ kind: 'village' as const, t })),
    ...far.deadTrees.map((t) => ({ kind: 'deadTree' as const, t })),
    ...far.autumnTrees.map((t) => ({ kind: 'autumnTree' as const, t })),
    ...far.scarecrows.map((t) => ({ kind: 'scarecrow' as const, t })),
    ...far.fence.map((t) => ({ kind: 'fence' as const, t })),
    { kind: 'wagon', t: far.wagon },
    ...far.hayStacks.map((t) => ({ kind: 'hayStack' as const, t })),
    { kind: 'well', t: far.well },
    { kind: 'shed', t: far.shed },
  ];
}

/** Ground footprints of the far things, so the fill keeps off them. */
export function farFootprints(far: PumpkinFar): Footprint[] {
  return farThings(far).map(({ kind, t }) => ({ x: t.x, z: t.z, hx: FAR_HALF[kind] * t.scale, hz: FAR_HALF[kind] * t.scale, rotY: t.rotY }));
}

/** The highest screen point (fraction from the top) of a thing at an aspect, or null when behind the camera. */
export function topOnScreen(x: number, h: number, z: number, aspect: number): { x: number; y: number } | null {
  const p = project([x, h, z] as Vec3, cameraAt(0, aspect, true));
  return p ? { x: p.x, y: p.y } : null;
}

// ----- the dusk clouds -----

/**
 * One sunset cloud bank: its centre on screen at rest (fractions, y from the top), its half width and half height (window
 * heights), its depth layer (0 far and hazy, 1 middle, 2 near and defined) and its puff count. A `wisp` is a thin faint streak
 * that may pass lightly over the moon's edge (never its face).
 */
export interface DuskCloud { sx: number; sy: number; hw: number; hh: number; layer: 0 | 1 | 2; puffs: number; wisp?: boolean }
/** Per layer: opacity, haze (how far it fades toward the sky), sideways drift (window widths) and its speed (radians a second). */
export const DUSK_LAYERS = [
  { alpha: 0.42, haze: 0.55, sway: 0.004, speed: 0.012 },
  { alpha: 0.62, haze: 0.25, sway: 0.006, speed: 0.016 },
  { alpha: 0.82, haze: 0.0, sway: 0.008, speed: 0.021 },
] as const;
/** How far each layer sits from the camera: far ones are farther. */
export const DUSK_DISTANCE = [300, 270, 240] as const;
/**
 * The banks: two to three large wide ones, several medium ones and a few long thin streaks, spread unevenly in the open sky
 * left of the stats (under the title) and between the search box and the moon (under the header buttons), well above the
 * barn roof and the windmill. Checked in `tests/pumpkinFar.test.ts`.
 */
export const DUSK_CLOUDS: readonly DuskCloud[] = [
  // Left: a large near bank with a medium one above it, a thin streak and a small far one.
  { sx: 0.115, sy: 0.225, hw: 0.15, hh: 0.024, layer: 2, puffs: 7 },
  { sx: 0.06, sy: 0.282, hw: 0.085, hh: 0.014, layer: 1, puffs: 5 },
  { sx: 0.175, sy: 0.188, hw: 0.075, hh: 0.007, layer: 0, puffs: 4 },
  { sx: 0.035, sy: 0.18, hw: 0.05, hh: 0.006, layer: 0, puffs: 3 },
  { sx: 0.2, sy: 0.302, hw: 0.06, hh: 0.008, layer: 1, puffs: 3 },
  // Right: a large near bank, a medium one, a far streak and a faint wisp across the moon's lower edge.
  { sx: 0.8, sy: 0.222, hw: 0.068, hh: 0.02, layer: 2, puffs: 6 },
  { sx: 0.808, sy: 0.29, hw: 0.05, hh: 0.011, layer: 1, puffs: 4 },
  { sx: 0.79, sy: 0.168, hw: 0.045, hh: 0.006, layer: 0, puffs: 3 },
  { sx: 0.86, sy: 0.338, hw: 0.085, hh: 0.0045, layer: 0, puffs: 3, wisp: true },
];
/** A puff: an elongated soft ellipse of a bank. Offsets and radii in window heights; `tone` 0 (underside) to 1 (top). */
export interface DuskPuff { dx: number; dy: number; rx: number; ry: number; tone: number; seed: number }
/** The puffs of every bank, seeded: uneven offsets and sizes, so no two banks are the same. */
export const DUSK_PUFFS: readonly (readonly DuskPuff[])[] = DUSK_CLOUDS.map((c, i) => {
  const rng = mulberry32(FAR_SEED + 101 + i * 17);
  return Array.from({ length: c.puffs }, (_, k) => {
    const u = c.puffs === 1 ? 0 : (k / (c.puffs - 1)) * 2 - 1;
    const rx = c.hw * (0.3 + rng() * 0.25);
    const ry = c.hh * (0.55 + rng() * 0.4) * (1 - 0.35 * Math.abs(u));
    // Spread along the bank, kept inside it; the middle puffs rise a little (a lumpy top, a flat base).
    const dx = Math.max(-c.hw + rx, Math.min(c.hw - rx, u * (c.hw - rx) + (rng() * 2 - 1) * 0.12 * c.hw));
    const dy = -(c.hh - ry) * (1 - Math.abs(u)) * (0.4 + rng() * 0.6);
    return { dx, dy, rx, ry, tone: 1 - Math.abs(u) * 0.5, seed: rng() * 100 };
  });
});
/** Triangles of the clouds: two per puff. */
export const duskPuffCount = (): number => DUSK_PUFFS.reduce((n, p) => n + p.length, 0);
/** Screen x of a bank's centre at time t: each layer drifts slowly to and fro at its own speed (parallax). */
export const duskCloudX = (c: DuskCloud, t: number): number => {
  const l = DUSK_LAYERS[c.layer];
  return c.sx + l.sway * Math.sin(t * l.speed + c.sx * 9);
};

/** Every puff on screen at time t: centre (fractions), radii (window heights), its bank and layer. */
export function duskPuffsOnScreen(aspect: number, t: number): { x: number; y: number; rx: number; ry: number; cloud: number; layer: number; wisp: boolean; puff: DuskPuff }[] {
  const out: ReturnType<typeof duskPuffsOnScreen> = [];
  DUSK_CLOUDS.forEach((c, i) => {
    const cx = duskCloudX(c, t);
    for (const p of DUSK_PUFFS[i]!) out.push({ x: cx + p.dx / aspect, y: c.sy + p.dy, rx: p.rx, ry: p.ry, cloud: i, layer: c.layer, wisp: !!c.wisp, puff: p });
  });
  return out;
}

/** World position of a screen point at a distance, seen from the resting camera. */
export function duskWorld(x: number, y: number, aspect: number, distance: number = DUSK_DISTANCE[1]): Vec3 {
  const cam = cameraAt(0, aspect, true);
  const d = directionAt(x, y, cam);
  return [cam.position[0] + d[0] * distance, cam.position[1] + d[1] * distance, cam.position[2] + d[2] * distance];
}

/** Closest a puff ellipse comes to the moon's centre, in window heights (sampled round its edge). */
function puffToMoon(p: { x: number; y: number; rx: number; ry: number }, m: { x: number; y: number }, aspect: number): number {
  let best = Infinity;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    for (const f of [0, 0.5, 1]) best = Math.min(best, Math.hypot((p.x - m.x) * aspect + Math.cos(a) * p.rx * f, p.y - m.y + Math.sin(a) * p.ry * f));
  }
  return best;
}
/**
 * True when a cloud covers the moon at time t in a window: a bank comes within `pad` of the disc, or a wisp reaches inside
 * 70% of its radius (a wisp may only cross the edge).
 */
export function duskOnMoon(aspect: number, t: number, pad = 0.015): boolean {
  const m = moonSpot(aspect);
  const r = moonScreenRadiusScaled(aspect, MOON_SCALE).disc;
  return duskPuffsOnScreen(aspect, t).some((p) => puffToMoon(p, m, aspect) < (p.wisp ? 0.7 * r : r + pad));
}
/** How close a bank is to the moon, 0 (far) to 1 (touching): it gets a faint pale rim. */
export function duskMoonRim(c: DuskCloud, aspect: number): number {
  const m = moonSpot(aspect);
  const d = Math.hypot((c.sx - m.x) * aspect, c.sy - m.y) - c.hw;
  return Math.max(0, Math.min(1, 1 - d / 0.15));
}

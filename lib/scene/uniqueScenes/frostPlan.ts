// The Frozen Cemetery as a simple, clear picture in three layers. Pure numbers, seeded: no three, no browser APIs.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16, and the horizon is at about 36 percent of the screen height).
//  1. Background: far snowy hills with a dark line of pine silhouettes (`buildBackdrop`, none of them under the moon), two small faded
//     ruined cottages on the horizon, the sky, the aurora and the moon.
//  2. Midground, the focal point: the haunted snow-covered house right of the middle (crooked walls, a sagging roof heavy with snow,
//     icicles, boarded windows with a faint flickering light, a leaning chimney with smoke, a tattered flag), with a broken iron gate and
//     fence in front of it; the round frozen pond on the left; the wolves on a far ridge on the left.
//  3. The snowy path from the bottom centre to the house's gate, with hanging lanterns on hook posts and a few tombstones on both sides,
//     and a broken fence behind them. The foreground corners hold one big pine and a tombstone (left) and a bare tree with two crows
//     (right). The middle behind the cards is empty snow.
// What the spooky parts mean (nothing here is decoration only): the path leads to the house, where your tabs are saved (the crypt); the
// hand in the pond is the tab you staked and forgot; the wolves and the crows watch the starving tabs.
import { cameraAt, project } from '../camera';
import { type Footprint, footprintsOverlap, type Placement } from '../layout';
import { mulberry32 } from '../rng';
import { clearSkyMoon, moonScreenRadiusScaled } from '../sky';
import { LAKE, onLake, turnLikeCompose, type Icicle, type Mound } from './frostIce';
import { VIEW_ASPECTS, distToPath, sampleLine } from './types';
/** Own random stream of the plan (added to the caller's seed). */
export const PLAN_SEED = 9137;
/** Size of the moon disc (1 is the Crypt's). */
export const FROST_MOON_SCALE = 1.05;
/**
 * Where the moon sits on screen: in the clear sky at the upper right, a little in from the right edge (the slow camera drift never pushes
 * it out of the window). Nothing of the scene stands over it.
 */
export function frostMoonTarget(aspect: number): { x: number; y: number } {
  const c = clearSkyMoon(aspect, FROST_MOON_SCALE);
  // Wide, short windows have the pinned pages close to the moon: there it keeps the shared spot.
  return { x: c.x - 0.022 * Math.min(1, Math.max(0, (2 - aspect) / 0.4)), y: c.y };
}
/** The haunted house: its middle, its size and its turn (a little toward the camera and the path). Its own units: 7 wide, 5.4 deep. */
export const HOUSE = { x: 3.8, z: -27, scale: 0.68, rotY: -0.12, frontZ: 2.7, halfW: 3.5, eaveY: 3.85, chimneyX: 2.1, chimneyZ: -0.7, chimneyTop: 7.2 } as const;
/** The footprint the house claims. */
export const HOUSE_FOOT: Footprint = { x: HOUSE.x, z: HOUSE.z, hx: 3.4, hz: 2.7, rotY: HOUSE.rotY };
/** A point of the house's own space in the world. */
export const housePoint = (lx: number, ly: number, lz: number): [number, number, number] => {
  const [x, y, z] = turnLikeCompose([lx * HOUSE.scale, ly * HOUSE.scale, lz * HOUSE.scale], HOUSE.rotY, undefined);
  return [HOUSE.x + x, y, HOUSE.z + z];
};
/** How far in front of the house (its own units) the broken fence and the gate stand, and the half width of the gate opening. */
export const GATE = { lz: 6.2, half: 1.2 } as const;
const DOOR = housePoint(0, 0, HOUSE.frontZ);
const GATE_AT = housePoint(0, 0, GATE.lz);
/** The snowy path from the bottom of the screen, up to the right, through the broken gate to the house door. */
export const PATH_POINTS: readonly (readonly [number, number])[] = [
  [0.5, 9], [1.2, 2], [2.4, -5], [3.4, -11], [4.0, -16.5], [GATE_AT[0], GATE_AT[2]], [DOOR[0] - 0.05, DOOR[2] + 1.0],
];
export const PATH_HALF_WIDTH = 1.3;
/** The ridge the wolves stand on, far back on the left. */
export const RIDGE = { x: -24, z: -36, rx: 8, rz: 3.6, ry: 2.4 } as const;
/** The bare tree in the right corner (kept short, so its top stays below the moon) and the big pine in the left corner. */
export const TREE_SPOT = { x: 6, z: -2, scale: 0.7 } as const;
export const PINE_SPOT = { x: -7.6, z: -1.2, scale: 0.6 } as const;
/** Tombstone sizes (before `scale`): the slab is 1 wide and 1.65 tall; the cross 1 wide and 1.55 tall. */
export const SLAB = { w: 1.0, h: 1.65, d: 0.3 } as const;
export const CROSS = { w: 1.0, h: 1.55, d: 0.26 } as const;
/** A hook post (a shepherd's crook): its height, where the lantern hangs from the end of its arm, and the middle of the lantern. */
export const LANTERN_POST = { h: 2.5, armX: 0.62, hookY: 2.42, flameY: 1.78 } as const;
/** The pond is round on the ground; the hole the hand reaches through is in it, a little toward the camera. */
export const POND_HOLE = { x: LAKE.x + 0.5, z: LAKE.z + 0.9 } as const;
/** A tombstone counts as inside the picture while it is no wider from the middle than this fraction of its depth. */
const VISIBLE = 0.5;
/** At most this many tombstones: a few, spaced, so the snow breathes. */
export const MAX_STONES = 14;
export interface Stone {
  kind: 'slab' | 'cross';
  x: number;
  z: number;
  rotY: number;
  scale: number;
  /** Lean about x and z. */
  tilt: [number, number];
  /** How far its foot is below the snow. */
  sink: number;
}
export interface PostLantern {
  x: number;
  z: number;
  rotY: number;
}
export interface Bar {
  x: number;
  z: number;
  rotY: number;
  lean: number;
  height: number;
  sink: number;
}
export interface Rail {
  x: number;
  y: number;
  z: number;
  rotY: number;
  length: number;
  lean: number;
}
export interface Print {
  x: number;
  z: number;
  rotY: number;
}
export interface Wolf {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  howl: boolean;
}
export interface Spot {
  x: number;
  z: number;
  rotY: number;
  scale: number;
}
export interface Perch {
  x: number;
  y: number;
  z: number;
  rotY: number;
}
/** One leaf of the broken iron gate: where its hinge stands, which way it faces, and how it hangs (`lean` about its own z). */
export interface GateLeaf {
  x: number;
  z: number;
  rotY: number;
  lean: number;
  /** +1 hinged on its left end, -1 on its right. */
  side: 1 | -1;
}
/** The tattered flag on its leaning pole: the foot of the pole, its lean and its height; the cloth hangs from the top. */
export interface Flag {
  x: number;
  z: number;
  rotY: number;
  lean: number;
  height: number;
}
/** The scary things on the snow, each kind drawn as one instanced mesh. */
export type PropKind = 'angel' | 'grave' | 'coffin' | 'bones' | 'well' | 'cart' | 'stump' | 'log' | 'ironGate';
export interface Prop extends Spot {
  kind: PropKind;
  /** Lean about x and z. */
  tilt: [number, number];
}
/** Rough radius of each kind on the ground (own units, before `scale`), for the claims. */
export const PROP_RADIUS: Record<PropKind, number> = { angel: 0.9, grave: 1.6, coffin: 1.2, bones: 0.5, well: 1.2, cart: 1.6, stump: 0.6, log: 1.3, ironGate: 1.6 };
/** Height of each kind (own units, before `scale`): what the screen checks use. */
export const PROP_HEIGHT: Record<PropKind, number> = { angel: 3.0, grave: 1.5, coffin: 0.7, bones: 0.4, well: 2.6, cart: 1.3, stump: 0.9, log: 0.6, ironGate: 2.3 };
/** The ruined steeple far back on the horizon, left of the middle: a dark silhouette. */
export const STEEPLE = { x: -31, z: -50, rotY: 0.3, scale: 1 } as const;
/** What is fixed before the trees go in. */
export interface FrostPlan {
  path: { x: number; z: number }[];
  stones: Stone[];
  /** Small icicles on the top edge of the slabs. */
  stoneIcicles: Icicle[];
  lanterns: PostLantern[];
  bars: Bar[];
  rails: Rail[];
  gate: GateLeaf[];
  flag: Flag;
  /** Small faded crooked cottages far back on the horizon, with a faint light in their windows. */
  cottages: Spot[];
  /** The scary things on the snow: a stone angel, an open grave, a coffin, bones, a well, a cart, stumps, logs, a leaning gate. */
  props: Prop[];
  prints: Print[];
  wolves: Wolf[];
  /** The one hand that reaches up through the hole in the pond. */
  hand: Spot;
  /** Soft snowdrifts and mounds on the ground. */
  drifts: Mound[];
  /** Icicles hanging from the house's eaves. */
  houseIcicles: Icicle[];
  /** Footprints everything else must keep out of. */
  claims: Footprint[];
}
/** What sits on the bare tree: the two crows. Needs the tree placement. */
export interface FrostAttached {
  crows: Perch[];
  treeIcicles: Icicle[];
}
/** Where a point of a model's own space ends up in the world (the model turned about y, scaled, then placed). */
export const worldOf = (p: Placement, local: readonly [number, number, number]): [number, number, number] => {
  const [x, y, z] = turnLikeCompose([local[0] * p.scale, local[1] * p.scale, local[2] * p.scale], p.rotY, undefined);
  return [p.x + x, p.y + y, p.z + z];
};
/** The two branch tips of `tree_dead_large` in its file (x, y, z). */
export const TREE_TIPS = { left: [-1.32, 3.86, -0.73], right: [0.98, 4.56, 0.65] } as const;
const inView = (x: number, z: number, r: number): boolean => Math.abs(x - 0.5) + r <= VISIBLE * (16 - z);
/** The path as centre points about 1.5 apart. */
export const pathCentre = (): { x: number; z: number }[] => sampleLine(PATH_POINTS, 1.5).map(({ x, z }) => ({ x, z }));
const foot = (x: number, z: number, hx: number, hz = hx, rotY = 0): Footprint => ({ x, z, hx, hz, rotY });
/** The height of a house's eave along its front, own units: the roof sags in the middle under the snow. */
export const eaveHeight = (lx: number): number => HOUSE.eaveY - 0.38 * (1 - (lx / (HOUSE.halfW + 0.5)) ** 2);
export function buildFrostPlan(seed: number): FrostPlan {
  const rng = mulberry32(PLAN_SEED + seed);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const path = pathCentre();
  const claims: Footprint[] = [HOUSE_FOOT, foot(RIDGE.x, RIDGE.z, RIDGE.rx, RIDGE.rz)];
  const free = (f: Footprint, margin = 0.2): boolean => !claims.some((c) => footprintsOverlap(f, c, margin));
  const claim = (f: Footprint): void => void claims.push(f);
  const clearOfPath = (x: number, z: number, r: number): boolean => distToPath(path, x, z) >= PATH_HALF_WIDTH + 0.6 + r;
  // The foreground corners: a tombstone and the pine on the left, the bare tree on the right.
  const stones: Stone[] = [{ kind: 'slab', x: -4.4, z: 3.0, rotY: 0.25, scale: 1.5, tilt: [0.02, 0.06], sink: 0.1 }];
  claim(foot(-4.4, 3.0, 1.1, 0.7));
  claim(foot(PINE_SPOT.x, PINE_SPOT.z, 2.2));
  claim(foot(TREE_SPOT.x, TREE_SPOT.z, 1.7));
  // The fences: one long broken run behind the graves, and the house's own fence on both sides of its gate.
  const bars: Bar[] = [];
  const rails: Rail[] = [];
  const run = (x0: number, z0: number, x1: number, z1: number, gap = 0.2) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rotY = Math.atan2(-(z1 - z0), x1 - x0);
    claim(foot((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.3, 0.7, rotY));
    const n = Math.max(1, Math.floor(len / 0.85));
    for (let i = 0; i <= n; i++) {
      if (rng() < gap) continue;
      const t = i / n;
      bars.push({
        x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, rotY, lean: between(-0.25, 0.25),
        height: rng() < 0.22 ? between(0.7, 1.1) : between(1.3, 1.7), sink: between(0.25, 0.65),
      });
    }
    for (const [k, y] of [[0, 0.5], [1, 1.15]] as const) {
      const at = k === 1 ? 0.3 : 0.5;
      rails.push({ x: x0 + (x1 - x0) * at, y, z: z0 + (z1 - z0) * at, rotY, length: len * (k === 1 ? 0.5 : 0.85), lean: k === 1 ? between(-0.15, 0.15) : 0 });
    }
  };
  run(-16, -25.5, -3.6, -27);
  const [lx0, , lz0] = housePoint(-HOUSE.halfW - 2.4, 0, GATE.lz);
  const [lx1, , lz1] = housePoint(-GATE.half, 0, GATE.lz);
  const [rx0, , rz0] = housePoint(GATE.half, 0, GATE.lz);
  const [rx1, , rz1] = housePoint(HOUSE.halfW + 1.6, 0, GATE.lz);
  run(lx0, lz0, lx1, lz1, 0.25);
  run(rx0, rz0, rx1, rz1, 0.3);
  // The broken gate: the left leaf swung wide open, the right one torn off its top hinge and hanging askew.
  const fenceTurn = Math.atan2(-(lz1 - lz0), lx1 - lx0);
  const gate: GateLeaf[] = [
    { x: lx1, z: lz1, rotY: fenceTurn - 1.25, lean: 0.04, side: 1 },
    { x: rx0, z: rz0, rotY: fenceTurn + 0.35, lean: -0.28, side: -1 },
  ];
  // The tattered flag on a leaning pole at the house's left front corner.
  const [fx, , fz] = housePoint(-HOUSE.halfW - 1.0, 0, HOUSE.frontZ - 0.6);
  const flag: Flag = { x: fx, z: fz, rotY: HOUSE.rotY + 0.5, lean: 0.12, height: 3.3 };
  claim(foot(fx, fz, 0.5));
  // The hanging lanterns beside the path: evenly spaced, alternating sides, each on a hook post whose arm reaches over the path.
  const samples = sampleLine(PATH_POINTS, 1.5);
  const lanterns: PostLantern[] = [];
  [0.2, 0.38, 0.56, 0.74].forEach((k, i) => {
    const s = samples[Math.min(samples.length - 1, Math.round(k * (samples.length - 1)))]!;
    const side = i % 2 ? 1 : -1;
    const x = s.x - s.dz * side * 2.1;
    const z = s.z + s.dx * side * 2.1;
    // The arm points toward the path (its +x side).
    lanterns.push({ x, z, rotY: Math.atan2(-(s.z - z), s.x - x) });
    claim(foot(x, z, 0.5));
  });
  // The tombstones: a few, spread out on both sides of the path. The middle behind the cards (near the camera) stays empty.
  const tryStone = (x: number, z: number, i: number): void => {
    if (stones.length >= MAX_STONES || !inView(x, z, 1.1) || onLake(x, z, 2.2) || !clearOfPath(x, z, 0.6)) return;
    if (z > -8.5 && Math.abs(x - 0.5) < 9) return;
    if (!free(foot(x, z, 0.6, 0.45), 0.9)) return;
    stones.push({
      kind: i % 3 === 1 ? 'cross' : 'slab', x, z, rotY: Math.atan2(0.5 - x, 16 - z) * 0.4 + between(-0.15, 0.15), scale: between(0.95, 1.2),
      tilt: [between(-0.05, 0.05), between(-0.14, 0.14)], sink: between(0.04, 0.18),
    });
    claim(foot(x, z, 0.6, 0.45));
  };
  sampleLine(PATH_POINTS, 3.6).forEach((s, i) => {
    if (s.z < -20) return;
    for (const side of [-1, 1] as const) {
      const off = (i + (side > 0 ? 1 : 0)) % 2 ? 3.6 : 7.4;
      tryStone(s.x - s.dz * side * (off + between(-0.4, 0.4)), s.z + s.dx * side * off, i + (side > 0 ? 1 : 0));
    }
  });
  // Small icicles on the top edge of each slab.
  const stoneIcicles: Icicle[] = [];
  for (const st of stones.slice(1)) {
    if (st.kind !== 'slab') continue;
    for (const side of [-1, 1]) {
      const [dx, dy, dz] = turnLikeCompose([side * 0.3 * st.scale, (SLAB.h - 0.12) * st.scale, (SLAB.d / 2 + 0.03) * st.scale], st.rotY, st.tilt);
      stoneIcicles.push({ x: st.x + dx, y: dy - st.sink, z: st.z + dz, length: between(0.28, 0.45), radius: between(0.035, 0.05) });
    }
  }
  // The scary things, spread over the empty snow on both sides (behind the tombstones, round the pond, the right foreground and both
  // sides of the house). Each is tried at its spot and a few seeded nudges; one that fits nowhere is left out.
  const props: Prop[] = [];
  const place = (kind: PropKind, x0: number, z0: number, scale = 1, rotY = 0, tilt: [number, number] = [0, 0]): Prop | null => {
    const r = PROP_RADIUS[kind] * scale;
    for (let t = 0; t < 10; t++) {
      const x = x0 + (t ? between(-1.6, 1.6) : 0);
      const z = z0 + (t ? between(-1.4, 1.4) : 0);
      if (!inView(x, z, r) || onLake(x, z, r + 0.4) || !clearOfPath(x, z, r)) continue;
      if (z > -8.5 && Math.abs(x - 0.5) < 9) continue;
      if (!free(foot(x, z, r), 0.3)) continue;
      const prop: Prop = { kind, x, z, rotY: rotY + between(-0.25, 0.25), scale, tilt };
      props.push(prop);
      claim(foot(x, z, r));
      return prop;
    }
    return null;
  };
  // Left: the angel watching the graves, an open grave with its shovel, a coffin in the snow, the well past the pond, a leaning gate.
  place('angel', -9.5, -15, 1.05, 0.35);
  const grave = place('grave', -10, -10.8, 1, 0.5);
  place('coffin', -12.5, -15.8, 1, 0.9, [0, 0.08]);
  place('well', -19, -29.5, 1, 0.4);
  place('ironGate', -10.2, -8.8, 0.9, 0.25, [0, 0.16]);
  // Right: the cart stuck in the snow, a coffin beside the house, another leaning gate.
  place('cart', 13.5, -12.5, 1, -0.7, [0.05, 0.1]);
  place('coffin', 12.5, -24.5, 0.9, -0.4, [0, -0.06]);
  place('ironGate', 15.5, -19.5, 0.95, -0.5, [0, -0.18]);
  // Stumps, logs and bones, a few on each side.
  for (const [x, z, sc] of [[-13, -19.5, 1.1], [11.5, -9.2, 1.1], [15, -16, 1], [-4.5, -30, 0.9], [11, -30, 1], [-8.5, -23, 1]] as const) place('stump', x, z, sc, between(0, 6));
  for (const [x, z, r] of [[10.6, -8.9, -0.4], [-7.5, -19.5, 0.3], [16, -22, 0.9], [-6, -26.5, -0.7], [18, -27, 0.5]] as const) place('log', x, z, between(0.9, 1.15), r);
  for (const [x, z] of [[-6.5, -12], [8.5, -14], [-11, -13], [11, -11], [10.5, -19.5], [-9, -28], [-3.8, -24], [14, -29]] as const) place('bones', x, z, between(0.9, 1.2), between(0, 6));
  // An old lantern on a crooked post by the open grave.
  if (grave) {
    const x = grave.x + 2.2;
    const z = grave.z + 0.6;
    if (free(foot(x, z, 0.5), 0.1)) {
      lanterns.push({ x, z, rotY: Math.PI });
      claim(foot(x, z, 0.5));
    }
  }
  // Footprints along the path toward the house: faint, one every step, alternating sides.
  const prints: Print[] = [];
  sampleLine(PATH_POINTS, 1.1).forEach((s, i) => {
    if (s.z > -2) return;
    const side = i % 2 ? 1 : -1;
    prints.push({ x: s.x - s.dz * side * 0.28, z: s.z + s.dx * side * 0.28, rotY: Math.atan2(s.dx, s.dz) + 0.08 * side });
  });
  // The wolves on the ridge, facing the moon on the right; the middle one howls.
  const wolves: Wolf[] = ([[-27.4, -35.6, 0.9, false], [-24, -36.4, 1.05, true], [-20.6, -35.4, 0.85, false]] as const).map(([x, z, scale, howl]) => {
    const lift = RIDGE.ry * Math.sqrt(Math.max(0, 1 - (x - RIDGE.x) ** 2 / RIDGE.rx ** 2 - (z - RIDGE.z) ** 2 / RIDGE.rz ** 2));
    return { x, y: lift - 0.12, z, rotY: -0.35, scale: scale * 1.15, howl };
  });
  const hand: Spot = { x: POND_HOLE.x, z: POND_HOLE.z, rotY: 0.2, scale: 1.5 };
  // Small faded crooked cottages far back on the horizon, on both sides, low and below the moon; the steeple stands among them on the left.
  const cottages: Spot[] = [
    { x: -17.5, z: -49, rotY: 0.35, scale: 1.0 },
    { x: -25, z: -51, rotY: -0.2, scale: 0.8 },
    { x: -40, z: -52, rotY: 0.5, scale: 0.9 },
    { x: 19.5, z: -52, rotY: -0.45, scale: 0.85 },
    { x: 30, z: -50, rotY: 0.25, scale: 0.95 },
  ];
  // Soft drifts: a low ring round the pond, heaps against the house walls, along the fences.
  const drifts: Mound[] = [];
  const ring = 16;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + between(-0.05, 0.05);
    const front = Math.sin(a) > 0.2;
    drifts.push({
      x: LAKE.x + (LAKE.rx + 0.5) * Math.cos(a), z: LAKE.z + (LAKE.rz + 0.5) * Math.sin(a), radius: front ? between(0.7, 1.0) : between(1.0, 1.5),
      rotY: -a + Math.PI / 2, stretch: 1.5, squash: front ? 0.25 : 0.35, y: -0.05,
    });
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 0.1 + (i / 7) * Math.PI * 1.8;
    const [x, , z] = housePoint(Math.cos(a) * 4.6, 0, Math.sin(a) * 3.6);
    if (!clearOfPath(x, z, 0.8)) continue;
    drifts.push({ x, z, radius: between(0.9, 1.4), rotY: -a, stretch: 1.6, squash: 0.4, y: -0.05 });
  }
  for (const b of bars.filter((_, i) => i % 3 === 0)) {
    if (!clearOfPath(b.x, b.z, 0.4)) continue;
    drifts.push({ x: b.x, z: b.z + 0.15, radius: between(0.8, 1.2), rotY: b.rotY, stretch: 1.8, squash: 0.38, y: -0.05 });
  }
  // Long gentle rises at both sides, behind the graves (they fill the empty snow without cluttering the middle).
  for (const [x, z, r] of [[-17, -12, 3.2], [-23, -6, 3.6], [21, -10, 3.4], [26, -4, 3.0], [-8, -31, 3.4], [3, -33, 3.6]] as const) {
    if (!inView(x, z, r) || onLake(x, z, r) || !free(foot(x, z, r * 0.8), 0)) continue;
    drifts.push({ x, z, radius: r, rotY: between(0, 3), stretch: 1.9, squash: 0.2, y: -0.05 });
  }
  // Icicles along the sagging front eave of the house and its left gable end.
  const houseIcicles: Icicle[] = [];
  const front = 11;
  for (let i = 0; i < front; i++) {
    const lx = -HOUSE.halfW - 0.3 + ((2 * HOUSE.halfW + 0.6) * (i + between(0.2, 0.8))) / front;
    const [x, y, z] = housePoint(lx, eaveHeight(lx) - 0.05, HOUSE.frontZ + 0.55);
    houseIcicles.push({ x, y, z, length: between(0.3, 0.9) * (i % 3 === 1 ? 1.4 : 1), radius: between(0.05, 0.09) });
  }
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = housePoint(-HOUSE.halfW - 0.5, HOUSE.eaveY - 0.1, -1.8 + i * 1.2 + between(-0.2, 0.2));
    houseIcicles.push({ x, y, z, length: between(0.3, 0.7), radius: between(0.05, 0.08) });
  }
  return { path, stones, stoneIcicles, lanterns, bars, rails, gate, flag, cottages, props, prints, wolves, hand, drifts, houseIcicles, claims };
}
/**
 * What sits on the bare trees and the tombstones: two crows on the corner tree, one on each other bare tree, and two on tombstones; and
 * icicles under the branches of every bare tree.
 */
export function attachToPlacements(placements: readonly Placement[], seed: number, stones: readonly Stone[] = []): FrostAttached {
  const rng = mulberry32(PLAN_SEED + seed + 11);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const trees = placements.filter((p) => p.model === 'tree_dead_large');
  const crows: Perch[] = [];
  const treeIcicles: Icicle[] = [];
  trees.forEach((tree, n) => {
    [TREE_TIPS.left, TREE_TIPS.right].forEach((tip, k) => {
      const w = worldOf(tree, tip);
      if (n === 0 || k === n % 2) crows.push({ x: w[0], y: w[1] + 0.05, z: w[2], rotY: tree.rotY + between(-0.5, 0.5) });
      for (let i = 0; i < 3; i++) {
        treeIcicles.push({ x: w[0] + between(-0.25, 0.25) * tree.scale, y: w[1] - between(0.1, 0.35), z: w[2] + between(-0.2, 0.2) * tree.scale, length: between(0.35, 0.8), radius: between(0.04, 0.07) });
      }
    });
  });
  // Crows on two tombstones away from the middle (the slabs' round tops).
  for (const st of stones.slice(1).filter((x) => x.kind === 'slab' && Math.abs(x.x - 0.5) > 6).slice(0, 2)) {
    crows.push({ x: st.x, y: SLAB.h * st.scale - st.sink + 0.02, z: st.z, rotY: st.rotY + Math.PI / 2 + between(-0.6, 0.6) });
  }
  return { crows, treeIcicles };
}
/** The ridge of the wolves, as a long low mound for the drawing. */
export const RIDGE_MOUND: Mound = { x: RIDGE.x, z: RIDGE.z, radius: RIDGE.rz, rotY: 0, stretch: RIDGE.rx / RIDGE.rz, squash: RIDGE.ry / RIDGE.rz, y: 0 };
/** One far hill and the line of pine silhouettes along its crest. */
export interface Hill {
  x: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}
export interface FarPine {
  x: number;
  y: number;
  z: number;
  /** Height. */
  scale: number;
}
/** True when a point would show over the moon disc (with a margin for the camera drift) at one of the usual window shapes. */
export function overMoon(p: readonly [number, number, number], margin = 0.035): boolean {
  return [...VIEW_ASPECTS, 4 / 3].some((a) => {
    const q = project(p, cameraAt(0, a, true));
    if (!q) return false;
    const t = frostMoonTarget(a);
    return Math.hypot((q.x - t.x) * a, q.y - t.y) < moonScreenRadiusScaled(a, FROST_MOON_SCALE).disc + margin;
  });
}
/**
 * The background: a chain of low, soft snowy hills across the whole width with a dark line of pine silhouettes along their crests, so the
 * ground never ends in a hard line. Everything is low (the pines are under 3.6 tall) so it stays below the chips and the search box, and
 * no pine rises in front of the moon.
 */
export function buildBackdrop(seed: number): { hills: Hill[]; pines: FarPine[] } {
  const rng = mulberry32(PLAN_SEED + seed + 29);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const hills: Hill[] = [];
  for (let x = -84; x <= 84; x += 17) hills.push({ x: x + between(-4, 4), z: between(-66, -52), rx: between(15, 22), ry: between(1.4, 2.3), rz: between(6, 9) });
  const pines: FarPine[] = [];
  const heightAt = (x: number, z: number) => hills.reduce((m, h) => Math.max(m, h.ry * Math.sqrt(Math.max(0, 1 - ((x - h.x) / h.rx) ** 2 - ((z - h.z) / h.rz) ** 2))), 0);
  for (let n = 0; n < 420 && pines.length < 150; n++) {
    const x = between(-90, 90);
    const z = between(-64, -46);
    const y = heightAt(x, z);
    const scale = between(1.9, 3.4);
    // Only on the hills, and in a loose band along the crest.
    if (y < 0.5) continue;
    if (overMoon([x, y - 0.15 + scale, z])) continue;
    pines.push({ x, y: y - 0.15, z, scale });
  }
  return { hills, pines };
}
/** How far the howling wolf has raised its head, 0 (resting) to 1 (nose to the moon), at a time. One howl every 20 seconds: up in 3, held 6, down in 3. */
export const HOWL_PERIOD_S = 20;
export function howlAmount(time: number): number {
  const t = ((time % HOWL_PERIOD_S) + HOWL_PERIOD_S) % HOWL_PERIOD_S;
  const ease = (k: number) => k * k * (3 - 2 * k);
  if (t < 3) return ease(t / 3);
  if (t < 9) return 1;
  if (t < 12) return ease(1 - (t - 9) / 3);
  return 0;
}
/**
 * The wind of the Frozen Cemetery, 0 (calm) to 1 (a gust), at a time: a slow swell with a gust about every 9 seconds. The trees, the
 * flag, the lanterns, the snow and the ghosts all read the same wind, so they move together but each with its own phase.
 */
export function gustAt(time: number): number {
  return 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.21)) + 0.3 * (0.5 + 0.5 * Math.sin(time * 0.7 + 1.3));
}
/** How far the wind has carried something that moves at one unit a second in a full gust: the integral of `gustAt` from 0. */
export function windTravel(time: number): number {
  return 0.675 * time - (0.175 / 0.21) * (Math.cos(time * 0.21) - 1) - (0.15 / 0.7) * (Math.cos(time * 0.7 + 1.3) - Math.cos(1.3));
}

// The extra things of the Frozen Cemetery, as plain numbers: the path, the chapel, the graveyard, the ice pillars, the lanterns, the
// fence, the wolves' ridge and everything that hangs from the dead trees. Pure and seeded: no three, no browser APIs.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
// What the spooky parts mean (nothing here is decoration only):
// - the snowy path runs from the bottom of the screen to the chapel door: that is where your tabs end up (the crypt);
// - the hands and the skull under the ice, and the skeletons in the pillars, are the tabs you have already staked and forgotten;
// - the wolves, the owl and the eyes among the pines watch the starving tabs; the gusts of wind are the cold draining the yard.
import { type Footprint, footprintsOverlap, type Placement } from '../layout';
import { mulberry32 } from '../rng';
import { LAKE, onLake, turnLikeCompose, type Icicle, type Mound } from './frostIce';
import { sampleLine, distToPath } from './types';
/** Own random stream of the plan (added to the caller's seed). */
export const PLAN_SEED = 9137;
/** The snowy path from the bottom of the screen, around the lake, to the chapel door. */
export const PATH_POINTS: readonly (readonly [number, number])[] = [
  [0.5, 9], [0.9, 3], [2.4, -3], [5.0, -9], [7.6, -14], [8.8, -19.5], [7.8, -24.0], [4.0, -26.2], [0.7, -26.9],
];
export const PATH_HALF_WIDTH = 1.3;
/** The ruined chapel: its middle, its size and the height of its door and its tower (in its own units, before `scale`). */
export const CHAPEL = { x: 0.5, z: -31.5, scale: 0.92, rotY: 0, frontZ: 4.0, towerX: -3.9, towerZ: -2.4 } as const;
/** The footprint the chapel claims (nothing else stands there). */
export const CHAPEL_FOOT: Footprint = { x: CHAPEL.x - 0.4, z: CHAPEL.z, hx: 5.4, hz: 4.8, rotY: 0 };
/** Door of the chapel in its own units: width, height of the straight part, and of the point. */
export const CHAPEL_DOOR = { width: 1.8, wall: 2.2, point: 3.0 } as const;
/** The ridge the wolves stand on, far back at the right, and the open snow in front of it. */
export const RIDGE = { x: 18, z: -34.5, rx: 7.5, rz: 3.6, ry: 2.6 } as const;
const SIGHT_CLEARING: Footprint = { x: 17.5, z: -27.5, hx: 5.5, hz: 3.2, rotY: 0 };
/** Tombstone sizes (before `scale`): the slab is 1 wide and 1.65 tall; the cross 1 wide and 1.55 tall. */
export const SLAB = { w: 1.0, h: 1.65, d: 0.3 } as const;
export const CROSS = { w: 1.0, h: 1.55, d: 0.26 } as const;
/** Height of an iron lantern post and of its flame. */
export const LANTERN_POST = { h: 2.1, flameY: 2.35 } as const;
/** The hanging, empty lantern of a dead tree. */
export const HANG_LENGTH = 0.9;
/** A visible tombstone counts as inside the picture while it is no wider from the middle than this fraction of its depth. */
const VISIBLE = 0.5;
/** At most this many tombstones in the yard. */
export const MAX_STONES = 46;
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
export interface OpenGrave {
  x: number;
  z: number;
  rotY: number;
}
export interface Pillar {
  x: number;
  z: number;
  rotY: number;
  scale: number;
}
export interface PostLantern {
  x: number;
  z: number;
  rotY: number;
}
export interface Candle {
  x: number;
  z: number;
}
export interface Bar {
  x: number;
  z: number;
  rotY: number;
  /** Lean about z. */
  lean: number;
  /** Height of the bar above the snow (full height is 1.7). */
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
export interface EyePair {
  x: number;
  y: number;
  z: number;
  /** Seconds offset of the blink, so the pairs never blink together. */
  phase: number;
}
export interface RockCap {
  x: number;
  y: number;
  z: number;
  radius: number;
}
/** What is fixed before the pines go in. */
export interface FrostPlan {
  path: { x: number; z: number }[];
  stones: Stone[];
  openGraves: OpenGrave[];
  pillars: Pillar[];
  lanterns: PostLantern[];
  candles: Candle[];
  bars: Bar[];
  rails: Rail[];
  prints: Print[];
  wolves: Wolf[];
  /** The stone the snowy owl sits on (its index) and where the owl stands. */
  owl: Perch;
  /** Hands and skull under the ice, and the hand that has broken through. */
  hands: Spot[];
  skull: Spot;
  broken: Spot;
  /** Drifts: the berm round the lake shore, round the chapel and the pillars, and along the fence. */
  drifts: Mound[];
  /** Icicles of the chapel's eaves. */
  chapelIcicles: Icicle[];
  /** Footprints everything else must keep out of. */
  claims: Footprint[];
}
/** What hangs from the dead trees, and what stands between the pines. Needs the placements. */
export interface FrostAttached {
  /** Empty lanterns hanging from a branch, and crows on a branch. */
  hanging: Perch[];
  crows: Perch[];
  treeIcicles: Icicle[];
  eyes: EyePair[];
  rockCaps: RockCap[];
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
/** The point on the path nearest to a fraction of its length, with the direction of the path there. */
function along(samples: readonly { x: number; z: number; dx: number; dz: number }[], k: number) {
  return samples[Math.min(samples.length - 1, Math.max(0, Math.round(k * (samples.length - 1))))]!;
}
export function buildFrostPlan(seed: number): FrostPlan {
  const rng = mulberry32(PLAN_SEED + seed);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const path = pathCentre();
  const claims: Footprint[] = [CHAPEL_FOOT, foot(RIDGE.x, RIDGE.z, RIDGE.rx, RIDGE.rz), SIGHT_CLEARING];
  const free = (f: Footprint, margin = 0.2): boolean => !claims.some((c) => footprintsOverlap(f, c, margin));
  const claim = (f: Footprint): void => void claims.push(f);
  const clearOfPath = (x: number, z: number, r: number): boolean => distToPath(path, x, z) >= PATH_HALF_WIDTH + 0.6 + r;
  // ----- the ice pillars (fixed spots, among the graves) -----
  const pillars: Pillar[] = [
    { x: -10.2, z: -6.5, rotY: 0.5, scale: 1.0 },
    { x: 12.5, z: -8.5, rotY: -0.4, scale: 1.12 },
  ];
  for (const p of pillars) claim(foot(p.x, p.z, 1.6 * p.scale));
  // ----- the fence: two broken runs, half buried -----
  const bars: Bar[] = [];
  const rails: Rail[] = [];
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rotY = Math.atan2(-(z1 - z0), x1 - x0);
    claim(foot((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.3, 0.7, rotY));
    const n = Math.floor(len / 0.8);
    for (let i = 0; i <= n; i++) {
      if (rng() < 0.22) continue;
      const t = i / n;
      bars.push({
        x: x0 + (x1 - x0) * t + between(-0.08, 0.08), z: z0 + (z1 - z0) * t + between(-0.08, 0.08), rotY,
        lean: between(-0.35, 0.35), height: rng() < 0.25 ? between(0.6, 1.0) : between(1.2, 1.7), sink: between(0.2, 0.7),
      });
    }
    // Two rails; the upper one is snapped half way.
    for (const [k, y] of [[0, 0.5], [1, 1.15]] as const) {
      const full = len * (k === 1 ? 0.55 : 0.85);
      const at = k === 1 ? 0.28 : 0.45;
      rails.push({ x: x0 + (x1 - x0) * at, y, z: z0 + (z1 - z0) * at, rotY, length: full, lean: k === 1 ? between(-0.2, 0.2) : 0 });
    }
  };
  run(-18, -11.5, -11.5, -14.2);
  run(12.5, -17, 18.5, -15.2);
  // ----- the lanterns along the path (they are also the warm lights) -----
  const samples = sampleLine(PATH_POINTS, 1.5);
  const lanterns: PostLantern[] = [];
  for (const [k, side] of [[0.27, -1], [0.43, 1], [0.66, 1], [0.86, -1]] as const) {
    const s = along(samples, k);
    const nx = -s.dz;
    const nz = s.dx;
    const x = s.x + nx * side * 2.3;
    const z = s.z + nz * side * 2.3;
    lanterns.push({ x, z, rotY: Math.atan2(0.5 - x, 16 - z) });
    claim(foot(x, z, 0.5));
  }
  // ----- the open graves (dark holes in the snow) -----
  const openGraves: OpenGrave[] = [];
  for (const [x, z, rotY] of [[-8.6, -3.4, 0.25], [11.6, -3.2, -0.3], [-14.4, -11.2, 0.5]] as const) {
    if (!free(foot(x, z, 1.5), 0)) continue;
    openGraves.push({ x, z, rotY });
    claim(foot(x, z, 1.6));
  }
  // ----- the tombstones, in loose rows on both sides of the path -----
  const stones: Stone[] = [];
  const rowSamples = sampleLine(PATH_POINTS, 3.0);
  const OFFSETS: readonly (readonly [number, number])[] = [[3.4, 1], [6.2, 0.9], [9.2, 0.7]];
  const tryStone = (x: number, z: number): boolean => {
    if (stones.length >= MAX_STONES || !inView(x, z, 1.2) || z > 1.5 || onLake(x, z, 2.4) || !clearOfPath(x, z, 0.6)) return false;
    if (x < -12.5 || x > 13.5) return false;
    if (!free(foot(x, z, 0.6, 0.45), 0.6) || stones.some((o) => Math.hypot(o.x - x, o.z - z) < 1.9)) return false;
    stones.push({
      kind: rng() < 0.28 ? 'cross' : 'slab', x, z, rotY: Math.atan2(0.5 - x, 16 - z) * 0.5 + between(-0.4, 0.4), scale: between(0.95, 1.5),
      tilt: [between(-0.12, 0.12), between(-0.24, 0.24)], sink: between(0.05, 0.28),
    });
    return true;
  };
  for (const s of rowSamples) {
    if (s.z < -21.5) continue;
    for (const side of [-1, 1] as const) {
      for (const [off, chance] of OFFSETS) {
        if (rng() > chance) continue;
        for (let t = 0; t < 3; t++) if (tryStone(s.x - s.dz * side * off + between(-0.9, 0.9), s.z + s.dx * side * off + between(-0.8, 0.8))) break;
      }
    }
  }
  // Loose stones between the rows, so the yard is full on both sides.
  for (let n = 0; n < 400 && stones.length < MAX_STONES; n++) tryStone(between(-12.5, 13.5), between(-21, 1));
  for (const st of stones) claim(foot(st.x, st.z, 0.6 * st.scale, 0.45 * st.scale, st.rotY));
  // ----- candles at the foot of some stones -----
  const candles: Candle[] = [];
  stones.forEach((st, i) => {
    if (i % 7 !== 3 || candles.length >= 6) return;
    candles.push({ x: st.x + Math.cos(st.rotY) * 0.75 * st.scale + Math.sin(st.rotY) * 0.5, z: st.z - Math.sin(st.rotY) * 0.75 * st.scale + Math.cos(st.rotY) * 0.5 });
  });
  // ----- the snowy owl: on a slab to the right of the path, a little way back -----
  const owlStone =
    stones.find((s) => s.kind === 'slab' && s.x > 4 && s.z < -4 && s.z > -16 && s.scale > 1.1) ??
    stones.find((s) => s.kind === 'slab') ?? { x: 4, z: -8, rotY: 0, scale: 1.2, tilt: [0, 0], sink: 0 };
  const owl: Perch = { x: owlStone.x, y: SLAB.h * owlStone.scale * 0.98 - owlStone.sink, z: owlStone.z, rotY: Math.atan2(0.5 - owlStone.x, 16 - owlStone.z) };
  // ----- footprints leading along the path toward the chapel -----
  const prints: Print[] = [];
  const steps = sampleLine(PATH_POINTS, 0.95);
  steps.forEach((s, i) => {
    if (s.z > 5.5) return;
    const side = i % 2 ? 1 : -1;
    prints.push({ x: s.x - s.dz * side * 0.3, z: s.z + s.dx * side * 0.3, rotY: Math.atan2(s.dx, s.dz) + 0.08 * side });
  });
  // ----- the wolves, on the ridge -----
  const wolves: Wolf[] = [
    [14.8, -34.0, 0.9, false], [17.6, -34.9, 1.05, true], [20.9, -34.0, 0.85, false],
  ].map(([x, z, scale, howl]) => {
    const lift = RIDGE.ry * Math.sqrt(Math.max(0, 1 - ((x as number) - RIDGE.x) ** 2 / RIDGE.rx ** 2 - ((z as number) - RIDGE.z) ** 2 / RIDGE.rz ** 2));
    return { x: x as number, y: lift - 0.12, z: z as number, rotY: -0.35, scale: (scale as number) * 1.15, howl: howl as boolean };
  });
  // ----- the hands and the skull under the ice, and the hand that broke through -----
  const hands: Spot[] = [
    { x: -8.4, z: -17.4, rotY: 0.3, scale: 1.0 },
    { x: -0.6, z: -17.7, rotY: -0.45, scale: 1.1 },
    { x: -6.4, z: -20.2, rotY: 0.8, scale: 0.95 },
  ];
  const skull: Spot = { x: -3.6, z: -17.0, rotY: 0.15, scale: 1.0 };
  const broken: Spot = { x: -5.6, z: -16.5, rotY: -0.2, scale: 1.2 };
  // ----- the drifts: a berm round the lake shore, round the chapel and the pillars, along the fence -----
  const drifts: Mound[] = [];
  const berm = 26;
  for (let i = 0; i < berm; i++) {
    const a = (i / berm) * Math.PI * 2 + between(-0.05, 0.05);
    const gap = 0.35 + between(0, 0.5);
    // The front of the shore (toward the camera) gets lower drifts, so the ice wall and the hands stay in view.
    const front = Math.sin(a) > 0.2;
    const radius = front ? between(0.9, 1.3) : between(1.3, 2.0);
    drifts.push({
      x: LAKE.x + (LAKE.rx + gap) * Math.cos(a), z: LAKE.z + (LAKE.rz + gap) * Math.sin(a), radius, rotY: -a + Math.PI / 2,
      stretch: 1.6, squash: front ? 0.28 : 0.4, y: -0.05,
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + between(-0.1, 0.1);
    const front = Math.sin(a) > 0.1;
    // Never across the path to the door.
    const x = CHAPEL.x + 5.0 * Math.cos(a);
    const z = CHAPEL.z + 4.6 * Math.sin(a) + 0.2;
    if (!clearOfPath(x, z, 1.0)) continue;
    drifts.push({ x, z, radius: front ? between(1.2, 1.7) : between(1.8, 2.5), rotY: -a + Math.PI / 2, stretch: 1.7, squash: front ? 0.4 : 0.5, y: -0.05 });
  }
  for (const p of pillars) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + between(0, 1);
      drifts.push({ x: p.x + 1.5 * p.scale * Math.cos(a), z: p.z + 1.4 * p.scale * Math.sin(a), radius: between(0.8, 1.2), rotY: a, stretch: 1.3, squash: 0.35, y: -0.05 });
    }
  }
  for (const b of bars.filter((_, i) => i % 3 === 0)) drifts.push({ x: b.x, z: b.z + 0.1, radius: between(0.8, 1.3), rotY: b.rotY, stretch: 1.8, squash: 0.4, y: -0.05 });
  // ----- icicles under the eaves of the chapel (the tower's belfry and the two roof edges) -----
  const chapelIcicles: Icicle[] = [];
  const s = CHAPEL.scale;
  const eave = (lx: number, ly: number, z0: number, z1: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const lz = z0 + ((z1 - z0) * (i + 0.5)) / count + between(-0.15, 0.15);
      chapelIcicles.push({ x: CHAPEL.x + lx * s, y: ly * s, z: CHAPEL.z + lz * s, length: between(0.45, 1.5), radius: between(0.08, 0.14) });
    }
  };
  eave(-3.95, 3.35, -1.2, 4.0, 8);
  eave(3.95, 3.35, -4.0, -1.5, 4);
  eave(3.95, 3.35, 1.0, 2.3, 2);
  // Belfry ledge and the front of the tower.
  for (let i = 0; i < 5; i++) {
    chapelIcicles.push({
      x: CHAPEL.x + (CHAPEL.towerX - 0.9 + i * 0.45) * s, y: 5.6 * s, z: CHAPEL.z + (CHAPEL.towerZ + 1.35) * s, length: between(0.4, 1.0), radius: between(0.07, 0.11),
    });
  }
  // The door arch and the gable edge.
  for (let i = 0; i < 4; i++) {
    chapelIcicles.push({ x: CHAPEL.x + (-1.1 + i * 0.7) * s, y: 3.3 * s, z: CHAPEL.z + 4.25 * s, length: between(0.35, 0.8), radius: between(0.06, 0.1) });
  }
  return { path, stones, openGraves, pillars, lanterns, candles, bars, rails, prints, wolves, owl, hands, skull, broken, drifts, chapelIcicles, claims };
}
/** The wolf's ridge in the plan: the smooth mound it stands on (a `Mound`-like description for the drawing). */
export const RIDGE_MOUND: Mound = { x: RIDGE.x, z: RIDGE.z, radius: RIDGE.rz, rotY: 0, stretch: RIDGE.rx / RIDGE.rz, squash: RIDGE.ry / RIDGE.rz, y: 0 };
/** Dead trees (`tree_dead_large`), pines and rocks of the placements decide the rest. */
export function attachToPlacements(placements: readonly Placement[], seed: number): FrostAttached {
  const rng = mulberry32(PLAN_SEED + seed + 11);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const trees = placements.filter((p) => p.model === 'tree_dead_large');
  const hanging: Perch[] = [];
  const crows: Perch[] = [];
  const treeIcicles: Icicle[] = [];
  trees.forEach((t, i) => {
    const left = worldOf(t, TREE_TIPS.left);
    const right = worldOf(t, TREE_TIPS.right);
    if (i % 2 === 0) hanging.push({ x: left[0], y: left[1], z: left[2], rotY: t.rotY });
    else crows.push({ x: left[0], y: left[1] + 0.05, z: left[2], rotY: t.rotY + between(-0.6, 0.6) });
    if (i % 3 === 0) crows.push({ x: right[0], y: right[1] + 0.05, z: right[2], rotY: t.rotY + between(-0.6, 0.6) });
    for (const tip of [left, right]) {
      for (let k = 0; k < 3; k++) {
        treeIcicles.push({ x: tip[0] + between(-0.25, 0.25) * t.scale, y: tip[1] - between(0, 0.2), z: tip[2] + between(-0.2, 0.2) * t.scale, length: between(0.35, 1.0), radius: between(0.05, 0.09) });
      }
    }
  });
  // Pairs of eyes low between pines: between two pines that stand close together, far enough back to be small.
  const pines = placements.filter((p) => p.model.startsWith('frost_pine') && p.z < -4);
  const eyes: EyePair[] = [];
  const used = new Set<number>();
  for (let i = 0; i < pines.length && eyes.length < 9; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < pines.length; j++) {
      const a = pines[i]!;
      const b = pines[j]!;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (used.has(j) || d < 3.2 || d > 6.5 || !inView(a.x, a.z, 0) || Math.abs(a.x - 0.5) < 6) continue;
      used.add(i);
      used.add(j);
      eyes.push({ x: (a.x + b.x) / 2, y: between(0.55, 0.95), z: (a.z + b.z) / 2 + 0.4, phase: between(0, 12) });
      break;
    }
  }
  const rockCaps: RockCap[] = placements
    .filter((p) => p.model === 'frost_rock')
    .map((p) => ({ x: p.x, y: p.y + 1.85 * p.scale * 0.78, z: p.z, radius: 1.52 * p.scale * 0.62 }));
  return { hanging, crows, treeIcicles, eyes, rockCaps };
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
/** How open a pair of eyes is (1 open, near 0 shut) at a time. Each pair blinks for a moment about every 9 seconds, at its own phase. */
export function blink(time: number, phase: number): number {
  const t = (((time + phase) % 9) + 9) % 9;
  return t < 0.2 ? Math.max(0.1, Math.abs(t - 0.1) / 0.1) : 1;
}
/** Time (seconds) of the next gust of wind-blown snow after `time`: a gust starts every 22 seconds, lasts 6, and swells and fades smoothly (0 to 1). */
export const GUST_PERIOD_S = 22;
export const GUST_LENGTH_S = 6;
export function gustAt(time: number): number {
  const t = ((time % GUST_PERIOD_S) + GUST_PERIOD_S) % GUST_PERIOD_S;
  if (t > GUST_LENGTH_S) return 0;
  return Math.sin((t / GUST_LENGTH_S) * Math.PI) ** 2;
}

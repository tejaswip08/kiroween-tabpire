// The Frozen Cemetery as a simple, clear picture in three layers. Pure numbers, seeded: no three, no browser APIs.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16, and the horizon is at about 36 percent of the screen height).
//  1. Background: far snowy hills with a dark line of pine silhouettes (`buildBackdrop`), the sky, the aurora and the moon.
//  2. Midground, the focal point: the ruined chapel on the right, the round frozen pond on the left, the wolves on a far ridge on the left.
//  3. The snowy path from the bottom centre to the chapel door, with five iron lanterns and neat rows of tombstones on both sides, and a broken
//     fence behind them. The foreground corners hold one big pine and an owl on a tombstone (left), a bare tree with two crows and an ice
//     block with a frozen skeleton (right). The middle behind the cards is empty snow.
// What the spooky parts mean (nothing here is decoration only): the path leads to the chapel, where your tabs are saved (the crypt); the hand in
// the pond is the tab you staked and forgot; the wolves, the owl and the crows watch the starving tabs.
import { type Footprint, footprintsOverlap, type Placement } from '../layout';
import { mulberry32 } from '../rng';
import { LAKE, onLake, turnLikeCompose, type Icicle, type Mound } from './frostIce';
import { distToPath, sampleLine } from './types';
/** Own random stream of the plan (added to the caller's seed). */
export const PLAN_SEED = 9137;
/** The snowy path from the bottom of the screen, up to the right, to the chapel door. */
export const PATH_POINTS: readonly (readonly [number, number])[] = [
  [0.5, 9], [1.2, 2], [3.4, -5], [6.8, -11], [10.2, -16.5], [12.6, -20.5], [13.2, -23.2],
];
export const PATH_HALF_WIDTH = 1.3;
/** The small ruined chapel on the right: its middle, its size and its turn (a little toward the camera). */
export const CHAPEL = { x: 13.8, z: -27, scale: 0.66, rotY: -0.3, frontZ: 4.0, towerX: -3.9, towerZ: -2.4 } as const;
/** The footprint the chapel claims. */
export const CHAPEL_FOOT: Footprint = { x: CHAPEL.x, z: CHAPEL.z, hx: 4.2, hz: 3.8, rotY: CHAPEL.rotY };
/** Door of the chapel in its own units: width, height of the straight part, and of the point. */
export const CHAPEL_DOOR = { width: 1.8, wall: 2.2, point: 3.0 } as const;
/** The ridge the wolves stand on, far back on the left. */
export const RIDGE = { x: -24, z: -36, rx: 8, rz: 3.6, ry: 2.4 } as const;
/** The bare tree in the right corner (kept short, so its top stays below the moon) and the big pine in the left corner. */
export const TREE_SPOT = { x: 6, z: -2, scale: 0.7 } as const;
export const PINE_SPOT = { x: -7.6, z: -1.2, scale: 0.6 } as const;
/** Tombstone sizes (before `scale`): the slab is 1 wide and 1.65 tall; the cross 1 wide and 1.55 tall. */
export const SLAB = { w: 1.0, h: 1.65, d: 0.3 } as const;
export const CROSS = { w: 1.0, h: 1.55, d: 0.26 } as const;
/** Height of an iron lantern post and of its flame. */
export const LANTERN_POST = { h: 2.1, flameY: 2.35 } as const;
/** The pond is round on the ground; the hole the hand reaches through is in it, a little toward the camera. */
export const POND_HOLE = { x: LAKE.x + 0.5, z: LAKE.z + 0.9 } as const;
/** A tombstone counts as inside the picture while it is no wider from the middle than this fraction of its depth. */
const VISIBLE = 0.5;
/** At most this many tombstones in the rows. */
export const MAX_STONES = 30;
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
/** What is fixed before the trees go in. */
export interface FrostPlan {
  path: { x: number; z: number }[];
  stones: Stone[];
  /** Small icicles on the top edge of the rows' slabs. */
  stoneIcicles: Icicle[];
  pillars: Pillar[];
  lanterns: PostLantern[];
  bars: Bar[];
  rails: Rail[];
  prints: Print[];
  wolves: Wolf[];
  /** Where the snowy owl sits (on the tombstone in the left corner). */
  owl: Perch;
  /** The one hand that reaches up through the hole in the pond. */
  hand: Spot;
  /** Soft snowdrifts and mounds on the ground. */
  drifts: Mound[];
  chapelIcicles: Icicle[];
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
/** A point of the chapel's own space in the world. */
export const chapelPoint = (lx: number, ly: number, lz: number): [number, number, number] => {
  const [x, y, z] = turnLikeCompose([lx * CHAPEL.scale, ly * CHAPEL.scale, lz * CHAPEL.scale], CHAPEL.rotY, undefined);
  return [CHAPEL.x + x, y, CHAPEL.z + z];
};
export function buildFrostPlan(seed: number): FrostPlan {
  const rng = mulberry32(PLAN_SEED + seed);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const path = pathCentre();
  const claims: Footprint[] = [CHAPEL_FOOT, foot(RIDGE.x, RIDGE.z, RIDGE.rx, RIDGE.rz)];
  const free = (f: Footprint, margin = 0.2): boolean => !claims.some((c) => footprintsOverlap(f, c, margin));
  const claim = (f: Footprint): void => void claims.push(f);
  const clearOfPath = (x: number, z: number, r: number): boolean => distToPath(path, x, z) >= PATH_HALF_WIDTH + 0.6 + r;
  // The foreground corners: the owl's tombstone and the pine on the left, the tree and the ice block on the right.
  const stones: Stone[] = [{ kind: 'slab', x: -4.4, z: 3.0, rotY: 0.25, scale: 1.5, tilt: [0.02, 0.06], sink: 0.1 }];
  claim(foot(-4.4, 3.0, 1.1, 0.7));
  claim(foot(PINE_SPOT.x, PINE_SPOT.z, 2.2));
  claim(foot(TREE_SPOT.x, TREE_SPOT.z, 1.7));
  const pillars: Pillar[] = [{ x: 5.8, z: 3.0, rotY: -0.4, scale: 0.9 }];
  claim(foot(5.8, 3.0, 1.6));
  // The fence, one long broken run behind the rows.
  const bars: Bar[] = [];
  const rails: Rail[] = [];
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rotY = Math.atan2(-(z1 - z0), x1 - x0);
    claim(foot((x0 + x1) / 2, (z0 + z1) / 2, len / 2 + 0.3, 0.7, rotY));
    const n = Math.floor(len / 0.85);
    for (let i = 0; i <= n; i++) {
      if (rng() < 0.2) continue;
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
  run(-10, -26, 6.2, -27.2);
  // The lanterns beside the path: small, evenly spaced, alternating sides.
  const samples = sampleLine(PATH_POINTS, 1.5);
  const lanterns: PostLantern[] = [];
  [0.2, 0.36, 0.52, 0.7, 0.88].forEach((k, i) => {
    const s = samples[Math.min(samples.length - 1, Math.round(k * (samples.length - 1)))]!;
    const side = i % 2 ? 1 : -1;
    const x = s.x - s.dz * side * 2.1;
    const z = s.z + s.dx * side * 2.1;
    lanterns.push({ x, z, rotY: Math.atan2(0.5 - x, 16 - z) });
    claim(foot(x, z, 0.5));
  });
  // The tombstones: two neat columns on each side of the path, spaced evenly. The middle behind the cards (near the camera) stays empty.
  const tryStone = (x: number, z: number, i: number): void => {
    if (stones.length >= MAX_STONES || !inView(x, z, 1.1) || onLake(x, z, 2.2) || !clearOfPath(x, z, 0.6)) return;
    if (z > -8.5 && Math.abs(x - 0.5) < 9) return;
    if (!free(foot(x, z, 0.6, 0.45), 0.4)) return;
    stones.push({
      kind: i % 5 === 3 ? 'cross' : 'slab', x, z, rotY: Math.atan2(0.5 - x, 16 - z) * 0.4 + between(-0.12, 0.12), scale: between(0.95, 1.2),
      tilt: [between(-0.05, 0.05), between(-0.14, 0.14)], sink: between(0.04, 0.18),
    });
    claim(foot(x, z, 0.6, 0.45));
  };
  sampleLine(PATH_POINTS, 3.0).forEach((s, i) => {
    if (s.z < -22.5) return;
    for (const side of [-1, 1] as const) {
      for (const off of [3.3, 6.4, 9.5]) tryStone(s.x - s.dz * side * off, s.z + s.dx * side * off, i + (side > 0 ? 1 : 0));
    }
  });
  // Small icicles on the top edge of each slab in the rows.
  const stoneIcicles: Icicle[] = [];
  for (const st of stones.slice(1)) {
    if (st.kind !== 'slab') continue;
    for (const side of [-1, 1]) {
      const [dx, dy, dz] = turnLikeCompose([side * 0.3 * st.scale, (SLAB.h - 0.12) * st.scale, (SLAB.d / 2 + 0.03) * st.scale], st.rotY, st.tilt);
      stoneIcicles.push({ x: st.x + dx, y: dy - st.sink, z: st.z + dz, length: between(0.28, 0.45), radius: between(0.035, 0.05) });
    }
  }
  // The foreground owl sits on the first tombstone.
  const first = stones[0]!;
  const owl: Perch = { x: first.x, y: SLAB.h * first.scale * 0.98 - first.sink, z: first.z, rotY: Math.atan2(0.5 - first.x, 16 - first.z) };
  // Footprints along the path toward the chapel: faint, one every step, alternating sides.
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
  // Soft drifts: a low ring round the pond, a few at the foot of the chapel, along the fence and round the ice block.
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
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 1.7;
    const [x, , z] = chapelPoint(Math.cos(a) * 5.6, 0, Math.sin(a) * 4.8 + 0.2);
    if (!clearOfPath(x, z, 1.0)) continue;
    drifts.push({ x, z, radius: between(1.1, 1.7), rotY: -a, stretch: 1.6, squash: 0.4, y: -0.05 });
  }
  for (let i = 0; i < 4; i++) drifts.push({ x: 5.8 + 1.5 * Math.cos(i * 1.6 + 0.4), z: 3.0 + 1.4 * Math.sin(i * 1.6 + 0.4), radius: between(0.7, 1.0), rotY: i, stretch: 1.3, squash: 0.32, y: -0.05 });
  for (const b of bars.filter((_, i) => i % 3 === 0)) drifts.push({ x: b.x, z: b.z + 0.15, radius: between(0.8, 1.2), rotY: b.rotY, stretch: 1.8, squash: 0.38, y: -0.05 });
  // Long gentle rises at both sides, behind the graves (they fill the empty snow without cluttering the middle).
  for (const [x, z, r] of [[-17, -12, 3.2], [-23, -6, 3.6], [21, -10, 3.4], [26, -4, 3.0], [-8, -31, 3.4], [3, -33, 3.6]] as const) {
    if (!inView(x, z, r) || onLake(x, z, r) || !free(foot(x, z, r * 0.8), 0)) continue;
    drifts.push({ x, z, radius: r, rotY: between(0, 3), stretch: 1.9, squash: 0.2, y: -0.05 });
  }
  // Icicles under the chapel's eaves and over its door.
  const chapelIcicles: Icicle[] = [];
  const eave = (lx: number, ly: number, z0: number, z1: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const [x, y, z] = chapelPoint(lx, ly, z0 + ((z1 - z0) * (i + 0.5)) / count + between(-0.15, 0.15));
      chapelIcicles.push({ x, y, z, length: between(0.4, 1.2), radius: between(0.07, 0.12) });
    }
  };
  eave(-3.95, 3.35, -1.2, 4.0, 7);
  eave(3.95, 3.35, -4.0, -1.5, 4);
  for (let i = 0; i < 5; i++) {
    const [x, y, z] = chapelPoint(CHAPEL.towerX - 0.9 + i * 0.45, 5.6, CHAPEL.towerZ + 1.35);
    chapelIcicles.push({ x, y, z, length: between(0.4, 0.9), radius: between(0.06, 0.1) });
  }
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = chapelPoint(-1.1 + i * 0.7, 3.3, 4.25);
    chapelIcicles.push({ x, y, z, length: between(0.35, 0.7), radius: between(0.06, 0.09) });
  }
  return { path, stones, stoneIcicles, pillars, lanterns, bars, rails, prints, wolves, owl, hand, drifts, chapelIcicles, claims };
}
/** The pond's hand and the two crows on the bare tree. */
export function attachToPlacements(placements: readonly Placement[], seed: number): FrostAttached {
  const rng = mulberry32(PLAN_SEED + seed + 11);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  const tree = placements.find((p) => p.model === 'tree_dead_large');
  const crows: Perch[] = [];
  const treeIcicles: Icicle[] = [];
  if (tree) {
    for (const tip of [TREE_TIPS.left, TREE_TIPS.right]) {
      const w = worldOf(tree, tip);
      crows.push({ x: w[0], y: w[1] + 0.05, z: w[2], rotY: tree.rotY + between(-0.5, 0.5) });
      for (let k = 0; k < 3; k++) {
        treeIcicles.push({ x: w[0] + between(-0.25, 0.25) * tree.scale, y: w[1] - between(0.1, 0.35), z: w[2] + between(-0.2, 0.2) * tree.scale, length: between(0.35, 0.8), radius: between(0.04, 0.07) });
      }
    }
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
/**
 * The background: a chain of low, soft snowy hills across the whole width with a dark line of pine silhouettes along their crests, so the
 * ground never ends in a hard line. Everything is low (the pines are under 3.6 tall) so it stays below the chips and the search box.
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
    // Only on the hills, and in a loose band along the crest.
    if (y < 0.5) continue;
    pines.push({ x, y: y - 0.15, z, scale: between(1.9, 3.4) });
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

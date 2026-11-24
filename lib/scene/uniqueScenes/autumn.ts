// The autumn lane of the Pumpkin Patch: the big old tree, the trick-or-treaters, the dry corn lane, the crooked fence,
// the grass banks and the leaves. Pure and seeded: no three, no browser APIs. `themes/autumn*.ts` turn these plans into meshes.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { cameraAt, directionAt, dot, basis, project } from '../camera';
import { mulberry32 } from '../rng';
import { moonScreenRadiusScaled } from '../sky';

export type V3 = [number, number, number];
export interface TrackPoint {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

// ---------- the winding trail ----------

/** A Catmull-Rom curve through the points, `sub` samples per segment. Used to bend the trail into gentle curves. */
export function smoothPolyline(points: readonly (readonly [number, number])[], sub = 6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const last = points[points.length - 1]!;
  out.push([last[0], last[1]]);
  return out;
}

/** Where a point at `offset` from the trail (sideways, `side` is -1 or 1) stands. */
export const sideOf = (c: TrackPoint, side: number, offset: number): { x: number; z: number } => ({
  x: c.x + c.dz * side * offset,
  z: c.z - c.dx * side * offset,
});

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Edge of the dirt trail, and the width the grass banks reach on each side. */
export const BANK = { inner: 1.15, outer: 7 };
/** How high the grass bank is at a distance from the trail's centre line: flat at the trail, a soft mound, then back to the ground. */
export function bankHeight(offset: number): number {
  const d = Math.abs(offset);
  if (d <= BANK.inner || d >= BANK.outer) return 0;
  return 0.3 * smooth(BANK.inner, 2.3, d) * (1 - smooth(3.6, BANK.outer, d)) + 0.0;
}

// ---------- the big autumn tree ----------

export type LeafTone = 'red' | 'orange' | 'gold' | 'deep';
export interface Tube {
  /** Control points of the centre line (Catmull-Rom). */
  points: V3[];
  /** Radius at each control point. */
  radii: number[];
}
export interface LeafCluster {
  x: number;
  y: number;
  z: number;
  r: number;
  tone: LeafTone;
  rotY: number;
}
export interface TreePlan {
  base: { x: number; z: number };
  trunk: Tube;
  branches: Tube[];
  /** The little branch that peeks in from the top-right corner, and its own leaves. */
  corner: Tube;
  clusters: LeafCluster[];
  cornerClusters: LeafCluster[];
  /** The knot hole on the trunk: its centre, how it faces and its size. */
  knot: { x: number; y: number; z: number; rotY: number; w: number; h: number };
}

export const TREE_BASE = { x: -4.4, z: 8 };
/** Footprint kept clear of props, around the trunk and its roots. */
export const TREE_FOOTPRINT = { x: TREE_BASE.x - 0.4, z: TREE_BASE.z, hx: 1.9, hz: 1.7, rotY: 0 };
const B = TREE_BASE;
const at = (x: number, y: number, z: number): V3 => [B.x + x, y, B.z + z];

/** The trunk leans out to the left as it climbs, so its top stays left of the brand (off screen on a narrow window). */
const TRUNK: Tube = {
  points: [at(0.3, -0.4, 0), at(0.15, 1.3, 0.05), at(-0.45, 2.8, -0.1), at(-1.1, 4.2, -0.2), at(-1.7, 5.6, -0.3), at(-2.2, 7.4, -0.3)],
  radii: [1.15, 0.92, 0.8, 0.7, 0.62, 0.52],
};
/**
 * The big limbs. The first arches up over the top of the scene toward the centre, above the header; the second reaches
 * up and over to the top-left; the third and fourth hold the low canopy on the left, under the brand.
 */
const LIMBS: Tube[] = [
  { points: [at(-1.4, 5.0, -0.3), at(0.2, 6.9, -1.4), at(2.6, 8.3, -3.4), at(5.6, 9.1, -6.2), at(9.0, 9.4, -9.6)], radii: [0.5, 0.4, 0.3, 0.19, 0.09] },
  { points: [at(-1.9, 6.2, -0.3), at(-1.4, 8.0, -1.6), at(-0.6, 9.6, -3.4), at(0.6, 10.8, -5.6)], radii: [0.42, 0.32, 0.2, 0.09] },
  { points: [at(-0.6, 3.3, -0.1), at(0.4, 3.9, -1.6), at(1.0, 4.2, -3.4), at(1.4, 4.5, -5.4)], radii: [0.36, 0.28, 0.18, 0.08] },
  { points: [at(-1.0, 3.9, -0.2), at(-1.2, 4.8, -2.6), at(-1.3, 5.3, -5.0), at(-1.6, 5.8, -8.0)], radii: [0.32, 0.25, 0.16, 0.07] },
];
/** The little branch that peeks in from the top-right corner, from off screen. */
const CORNER: Tube = { points: [[11.6, 9.0, 4.2], [9.4, 8.0, 3.8], [7.6, 7.4, 3.5], [6.6, 7.0, 3.3]], radii: [0.34, 0.22, 0.12, 0.05] };

/** A point on a Catmull-Rom curve through `points`, with t from 0 to 1. */
export function curvePoint(points: readonly V3[], t: number): V3 {
  const n = points.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const u = f - i;
  const p0 = points[Math.max(0, i - 1)]!;
  const p1 = points[i]!;
  const p2 = points[i + 1]!;
  const p3 = points[Math.min(n, i + 2)]!;
  const u2 = u * u;
  const u3 = u2 * u;
  const k = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1]), k(p0[2], p1[2], p2[2], p3[2])];
}
/** The radius along a tube, linear between the control radii. */
export function radiusAt(tube: Tube, t: number): number {
  const n = tube.radii.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(f), n - 1);
  return tube.radii[i]! + (tube.radii[i + 1]! - tube.radii[i]!) * (f - i);
}

/** The window sizes (CSS pixels) the framing is checked at: a 16:10 laptop, full HD, the window of the reference shot and an ultrawide. */
export const FRAME_WINDOWS: readonly (readonly [number, number])[] = [[1440, 900], [1920, 1080], [1695, 723], [2560, 1080]];
export interface ScreenRect {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
/**
 * Where the page's own controls sit in a window, as fractions (y from the top), from the page's CSS: a centred column of
 * 1400px (24px padding) with the brand on the left, the stats panel in the middle and the buttons on the right of the
 * header, then the 640px search box, the pinned pages and the state chips. Each has a margin of about 8px. The tree keeps
 * out of all of them, so it frames the page without sitting behind any text or control.
 */
export function uiRects(w: number, h: number): ScreenRect[] {
  const col = Math.min(1400, w - 48);
  const left = (w - col) / 2;
  const right = left + col;
  const mid = w / 2;
  const r = (name: string, x0: number, x1: number, y0: number, y1: number): ScreenRect => ({ name, x0: x0 / w, x1: x1 / w, y0: y0 / h, y1: y1 / h });
  return [
    r('brand', left - 8, left + 340, 38, 122),
    r('stats', mid - 300, mid + 300, 14, 158),
    r('actions', right - 380, right + 8, 46, 108),
    r('search', mid - 330, mid + 330, 138, 212),
    r('pinned and chips', mid - 360, mid + 360, 212, 330),
  ];
}
/** The canopy never hangs lower than the top of the cards (in CSS pixels from the top). */
export const CANOPY_MAX_PX = 330;
const overlaps = (a: { x0: number; x1: number; y0: number; y1: number }, r: ScreenRect) => a.x0 < r.x1 && a.x1 > r.x0 && a.y0 < r.y1 && a.y1 > r.y0;

/** Screen extent of a ball: its centre and how far it reaches each way (x and y are fractions of the window). */
export function ballOnScreen(x: number, y: number, z: number, r: number, aspect: number): { cx: number; cy: number; rx: number; ry: number } | null {
  const cam = cameraAt(0, aspect, true);
  const p = project([x, y, z], cam);
  if (!p) return null;
  const tanH = Math.tan((cam.fov * Math.PI) / 360);
  const ry = r / (2 * p.depth * tanH);
  return { cx: p.x, cy: p.y, rx: ry / aspect, ry };
}
/**
 * What a ball (a leaf cluster, or a piece of a branch) would sit behind in some window: a control, the cards, or the moon.
 * Null when it keeps clear of all of them in every window. A ball fully off screen is always fine.
 */
export function ballBlocks(x: number, y: number, z: number, r: number, low = true): string | null {
  for (const [w, h] of FRAME_WINDOWS) {
    const aspect = w / h;
    const s = ballOnScreen(x, y, z, r, aspect);
    if (!s) return 'behind the camera';
    const box = { x0: s.cx - s.rx, x1: s.cx + s.rx, y0: s.cy - s.ry, y1: s.cy + s.ry };
    if (box.x1 < 0 || box.x0 > 1 || box.y1 < 0 || box.y0 > 1) continue;
    if (low && box.y1 > CANOPY_MAX_PX / h) return `too low @${w}`;
    for (const rect of uiRects(w, h)) if (overlaps(box, rect)) return `${rect.name} @${w}`;
    const moon = { x: 0.78, y: 0.34 };
    const keep = moonScreenRadiusScaled(aspect, 1.6).disc * 1.25 + s.ry;
    if (Math.hypot((s.cx - moon.x) * aspect, s.cy - moon.y) < keep) return `moon @${w}`;
  }
  return null;
}
/** Does a ball of leaves keep clear of the page's controls and the moon in every window? */
export const leavesFit = (x: number, y: number, z: number, r: number): boolean => ballBlocks(x, y, z, r) === null;
/** Balls along a tube (its radius at each), for checking the wood. */
export function tubeBalls(tube: Tube, n = 24): { x: number; y: number; z: number; r: number }[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = curvePoint(tube.points, i / n);
    return { x: p[0], y: p[1], z: p[2], r: radiusAt(tube, i / n) };
  });
}

const TONES: readonly LeafTone[] = ['red', 'red', 'orange', 'orange', 'gold', 'deep'];
const CORNER_TONES: readonly LeafTone[] = ['red', 'red', 'red', 'deep', 'orange'];

export function buildTreePlan(seed: number): TreePlan {
  const rng = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const branches: Tube[] = [...LIMBS];
  // Twigs: a short thin branch from a point along each limb, leaning up and out.
  LIMBS.forEach((limb, li) => {
    for (let k = 0; k < 4; k++) {
      const t = 0.3 + 0.17 * k + between(-0.04, 0.04);
      const p = curvePoint(limb.points, t);
      const ang = between(0, Math.PI * 2);
      const len = between(1.1, 2.0);
      const mid: V3 = [p[0] + Math.cos(ang) * len * 0.5, p[1] + len * 0.35, p[2] + Math.sin(ang) * len * 0.5];
      const tip: V3 = [p[0] + Math.cos(ang) * len, p[1] + len * 0.75, p[2] + Math.sin(ang) * len];
      const r0 = radiusAt(limb, t) * 0.5;
      const twig: Tube = { points: [p, mid, tip], radii: [r0, r0 * 0.6, 0.04] };
      if (tubeBalls(twig, 6).every((b) => ballBlocks(b.x, b.y, b.z, b.r, false) === null)) branches.push(twig);
    }
    void li;
  });
  const clusters: LeafCluster[] = [];
  const tryCluster = (list: LeafCluster[], x: number, y: number, z: number, r: number, tones: readonly LeafTone[]) => {
    if (!leavesFit(x, y, z, r)) return false;
    list.push({ x, y, z, r, tone: tones[Math.floor(rng() * tones.length)]!, rotY: between(0, Math.PI * 2) });
    return true;
  };
  // Leaves along every limb and twig, and a crown above the trunk.
  for (const tube of branches) {
    const steps = tube.radii[0]! > 0.2 ? 14 : 4;
    for (let s = 0; s < steps; s++) {
      const p = curvePoint(tube.points, 0.25 + 0.75 * (s / steps));
      for (let tries = 0; tries < 3; tries++) {
        const r = between(0.95, 1.75);
        if (tryCluster(clusters, p[0] + between(-1.2, 1.2), p[1] + between(-0.2, 1.7), p[2] + between(-1.2, 1.2), r, TONES)) break;
      }
    }
  }
  // Then fill the free parts of the screen: the band under the brand on the left, the left margin, the top edge above the
  // header (where only the lowest leaves hang into view) and the gaps beside the stats panel.
  const cam = cameraAt(0, 16 / 9, true);
  const fwd = basis(cam).f;
  const AREAS: readonly [number, number, number, number, number][] = [
    // x0, x1, y0, y1, weight (screen fractions at 16:9)
    [-0.08, 0.3, 0.12, 0.3, 4],
    [-0.08, 0.12, -0.08, 0.3, 3],
    [-0.05, 0.7, -0.2, 0.0, 4],
    [0.3, 0.34, -0.05, 0.12, 1],
  ];
  const total = AREAS.reduce((n, a) => n + a[4], 0);
  for (let i = 0; i < 2400 && clusters.length < 200; i++) {
    let k = rng() * total;
    const area = AREAS.find((a) => (k -= a[4]) < 0) ?? AREAS[0]!;
    const depth = between(6.5, 17);
    const dir = directionAt(between(area[0], area[1]), between(area[2], area[3]), cam);
    const t = depth / dot(dir, fwd);
    const x = cam.position[0] + dir[0] * t;
    const y = cam.position[1] + dir[1] * t;
    const z = cam.position[2] + dir[2] * t;
    tryCluster(clusters, x, y, z, depth * between(0.04, 0.085), TONES);
  }
  const cornerClusters: LeafCluster[] = [];
  for (let s = 0; s < 16; s++) {
    const p = curvePoint(CORNER.points, 0.1 + 0.9 * (s / 16));
    for (let tries = 0; tries < 8; tries++) {
      if (tryCluster(cornerClusters, p[0] + between(-0.8, 1.2), p[1] + between(-1.6, 1.0), p[2] + between(-0.5, 0.5), between(0.45, 1.0), CORNER_TONES)) break;
    }
  }
  const knotT = 0.3;
  const knotCentre = curvePoint(TRUNK.points, knotT);
  const knotR = radiusAt(TRUNK, knotT);
  const knotY = knotCentre[1];
  // The hole faces the camera (a little to the right, toward the trail).
  const rotY = 0.45;
  return {
    base: { x: B.x, z: B.z },
    trunk: TRUNK,
    branches,
    corner: CORNER,
    clusters,
    cornerClusters,
    knot: { x: knotCentre[0] + Math.sin(rotY) * knotR * 1.02, y: knotY, z: knotCentre[2] + Math.cos(rotY) * knotR * 1.02, rotY, w: 0.34, h: 0.5 },
  };
}

// ---------- the trick-or-treaters ----------

export type KidKind = 'ghost' | 'witch';
export interface Route {
  /** Points along the trail the children walk, toward the barn. */
  points: { x: number; z: number }[];
  /** Distance from the start to each point. */
  at: number[];
  length: number;
}
/** The stretch of trail the children walk: from near the camera toward the barn door. */
export function routeOf(line: readonly TrackPoint[], zFrom: number, zTo: number): Route {
  const points = line.filter((c) => c.z <= zFrom && c.z >= zTo).map((c) => ({ x: c.x, z: c.z }));
  const at: number[] = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z));
  return { points, at, length: at[at.length - 1] ?? 0 };
}
/** A point `s` along the route, with the heading to walk (a unit vector). Clamped to the ends. */
export function pointAlong(route: Route, s: number): { x: number; z: number; dx: number; dz: number } {
  const n = route.points.length;
  if (n < 2) return { x: route.points[0]?.x ?? 0, z: route.points[0]?.z ?? 0, dx: 0, dz: -1 };
  const d = Math.min(Math.max(s, 0), route.length);
  let i = 1;
  while (i < n - 1 && route.at[i]! < d) i++;
  const a = route.points[i - 1]!;
  const b = route.points[i]!;
  const seg = route.at[i]! - route.at[i - 1]! || 1;
  const k = (d - route.at[i - 1]!) / seg;
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
}
/** Walking speed in units per second, and the pause before they come back at the start. */
export const KID_SPEED = 0.5;
export const KID_PAUSE_S = 2.5;
/** Length of the fade at both ends of the walk, as a share of the walk. */
export const KID_FADE = 0.06;
/**
 * Where the children are at time `t`: how far along the route (0 to 1 of the walk), and how big they are (they shrink away
 * at the barn and grow in again at the start). With reduced motion they stand still partway along the route.
 */
export function kidsAt(route: Route, t: number, reduced: boolean): { s: number; scale: number } {
  if (reduced) return { s: route.length * 0.3, scale: 1 };
  const walk = route.length / KID_SPEED;
  const cycle = walk + KID_PAUSE_S;
  const u = ((t % cycle) + cycle) % cycle;
  if (u >= walk) return { s: 0, scale: 0 };
  const f = u / walk;
  const scale = Math.min(1, f / KID_FADE, (1 - f) / KID_FADE);
  return { s: f * route.length, scale: smooth(0, 1, scale) };
}
/** Sideways offset of each child from the middle of the trail. */
export const KID_LATERAL: Record<KidKind, number> = { ghost: -0.33, witch: 0.33 };
/** Child heights, for the tests (the dry corn must be taller). */
export const KID_HEIGHT = { ghost: 1.25, witch: 1.6 };

// ---------- dry corn, fence, tufts, leaves, light ----------

export interface Stalk {
  x: number;
  z: number;
  y: number;
  rotY: number;
  scale: number;
  leanX: number;
  leanZ: number;
}
export interface FencePost {
  x: number;
  z: number;
  y: number;
  height: number;
  leanX: number;
  leanZ: number;
  /** The post's bay to the next one is missing a rail. */
  gap: boolean;
}
export interface Tuft {
  x: number;
  z: number;
  y: number;
  rotY: number;
  scale: number;
  /** 0 to 1: greener to yellower. */
  hue: number;
}
export interface FallenLeaf {
  x: number;
  z: number;
  y: number;
  rotY: number;
  scale: number;
  tone: LeafTone | 'brown';
}
export interface LightPatch {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rotY: number;
  phase: number;
}
export interface AutumnPlan {
  tree: TreePlan;
  route: Route;
  /** The trail's centre line, for the grass banks. */
  line: TrackPoint[];
  stalks: Stalk[];
  /** One list of posts for each side of the trail (left first). */
  fence: FencePost[][];
  tufts: Tuft[];
  leaves: FallenLeaf[];
  patches: LightPatch[];
}

/** Where the fence stands, where the jack-o'-lanterns sit at its foot and where the dry corn starts, as distances from the trail's centre line. */
export const LANE = { jack: 1.95, fence: 2.5, corn: [3.1, 4.6] as const };
/** The lane runs along the trail between these z values. */
export const LANE_Z = { from: 8.5, to: -15.5 };
/** Nothing of the lane grows this close to the tree's trunk. */
const TREE_CLEAR = 2.3;
const nearTree = (x: number, z: number) => Math.hypot(x - TREE_FOOTPRINT.x, z - TREE_FOOTPRINT.z) < TREE_CLEAR;

export function buildAutumnPlan(seed: number, line: readonly TrackPoint[]): AutumnPlan {
  const rng = mulberry32(seed + 31);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const lane = line.filter((c) => c.z <= LANE_Z.from && c.z >= LANE_Z.to);
  const stalks: Stalk[] = [];
  const fence: FencePost[][] = [[], []];
  lane.forEach((c, i) => {
    [-1, 1].forEach((side, si) => {
      // Two ragged rows of dry stalks behind the fence.
      for (let k = 0; k < 3; k++) {
        const off = between(LANE.corn[0], LANE.corn[1]);
        const p = sideOf(c, side, off);
        const x = p.x + between(-0.45, 0.45);
        const z = p.z + between(-0.55, 0.55);
        const lean = between(0.04, 0.2);
        const dir = between(0, Math.PI * 2);
        if (nearTree(x, z)) continue;
        stalks.push({ x, z, y: bankHeight(off), rotY: between(0, Math.PI * 2), scale: between(0.95, 1.3), leanX: Math.cos(dir) * lean, leanZ: Math.sin(dir) * lean });
      }
      // A post about every second sample (3 units apart), each leaning a little, none the same height.
      if (i % 2 === 0) {
        const p = sideOf(c, side, LANE.fence + between(-0.12, 0.12));
        if (nearTree(p.x, p.z)) return;
        fence[si]!.push({
          x: p.x, z: p.z, y: bankHeight(LANE.fence), height: between(0.85, 1.25),
          leanX: between(-0.14, 0.14), leanZ: between(-0.14, 0.14), gap: rng() < 0.14,
        });
      }
    });
  });
  // Grass tufts on the banks and a few further out.
  const tufts: Tuft[] = [];
  for (let i = 0; i < 520; i++) {
    const c = line[Math.floor(rng() * line.length)]!;
    const side = rng() < 0.5 ? -1 : 1;
    const off = between(BANK.inner + 0.15, 6.2);
    const p = sideOf(c, side, off);
    tufts.push({ x: p.x + between(-0.5, 0.5), z: p.z + between(-0.5, 0.5), y: bankHeight(off) - 0.02, rotY: between(0, Math.PI * 2), scale: between(0.7, 1.7), hue: rng() });
  }
  // Fallen leaves: more on the trail, some on the grass.
  const leaves: FallenLeaf[] = [];
  const tones: (LeafTone | 'brown')[] = ['red', 'red', 'orange', 'orange', 'gold', 'deep', 'brown'];
  for (let i = 0; i < 300; i++) {
    const c = line[Math.floor(rng() * line.length)]!;
    const onTrail = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    const off = onTrail ? between(0, 1.15) : between(1.3, 5.8);
    const p = sideOf(c, side, off);
    leaves.push({ x: p.x, z: p.z, y: onTrail ? 0.07 : bankHeight(off) + 0.04, rotY: between(0, Math.PI * 2), scale: between(0.6, 1.3), tone: tones[Math.floor(rng() * tones.length)]! });
  }
  // Warm patches of light on the trail.
  const patches: LightPatch[] = [];
  for (let i = 0; i < 12; i++) {
    const c = line[Math.floor((i + 0.5 + between(-0.3, 0.3)) * (line.length / 12))]!;
    const p = sideOf(c, rng() < 0.5 ? -1 : 1, between(0, 0.6));
    patches.push({ x: p.x, z: p.z, rx: between(0.9, 1.7), rz: between(0.6, 1.2), rotY: Math.atan2(c.dx, c.dz) + between(-0.4, 0.4), phase: between(0, 6.28) });
  }
  return {
    tree: buildTreePlan(seed + 17),
    route: routeOf(line, 3, -15.2),
    line: [...line],
    stalks,
    fence,
    tufts,
    leaves,
    patches,
  };
}

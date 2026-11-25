// The autumn lane of the Pumpkin Patch: the big old tree, the trick-or-treaters, the dry corn lane, the crooked fence,
// the grass banks and the leaves. Pure and seeded: no three, no browser APIs. `themes/autumn*.ts` turn these plans into meshes.
// Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import { cameraAt, directionAt, dot, basis, project } from '../camera';
import { footprintOf, footprintsOverlap, type Footprint, type Placement } from '../layout';
import { mulberry32 } from '../rng';
import { clearSkyMoon, moonScreenRadiusScaled } from '../sky';

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
  clusters: LeafCluster[];
  /** The knot hole on the trunk: its centre, how it faces and its size. */
  knot: { x: number; y: number; z: number; rotY: number; w: number; h: number };
}

/**
 * The tree stands in the left field, far enough back that the whole of it (roots, trunk and crown) is on screen in every
 * window, under the brand and left of the search box and the chips.
 */
export const TREE_BASE = { x: -8.6, z: -2 };
/** Footprint kept clear of props, around the trunk, the roots and under the crown. */
export const TREE_FOOTPRINT = { x: TREE_BASE.x, z: TREE_BASE.z, hx: 1.6, hz: 1.6, rotY: 0 };
const B = TREE_BASE;
const at = (x: number, y: number, z: number): V3 => [B.x + x, y, B.z + z];

/** A short, thick, slightly twisted trunk with flared roots. */
const TRUNK: Tube = {
  points: [at(0, -0.3, 0), at(0.06, 0.9, 0), at(-0.06, 1.8, 0.05), at(0.04, 2.6, 0)],
  radii: [0.6, 0.44, 0.38, 0.33],
};
/** It splits into four limbs that curve up and out into the crown: left, right, up and back. */
const LIMBS: Tube[] = [
  { points: [at(0, 2.3, 0), at(-0.7, 3.2, 0.2), at(-1.3, 4.0, 0.3), at(-1.6, 4.8, 0.2)], radii: [0.27, 0.2, 0.13, 0.05] },
  { points: [at(0, 2.4, 0), at(0.75, 3.2, -0.1), at(1.3, 3.9, -0.2), at(1.6, 4.7, -0.1)], radii: [0.27, 0.2, 0.13, 0.05] },
  { points: [at(0, 2.5, 0), at(0.1, 3.5, -0.2), at(-0.1, 4.5, -0.3), at(0.05, 5.4, -0.2)], radii: [0.29, 0.21, 0.14, 0.05] },
  { points: [at(0, 2.2, 0), at(0.25, 3.0, -0.7), at(0.4, 3.8, -1.2), at(0.5, 4.5, -1.5)], radii: [0.22, 0.16, 0.1, 0.04] },
];
/** The crown: an egg of leaves around the top of the limbs, wider than it is tall. */
export const CROWN = { x: B.x, y: 4.55, z: B.z - 0.3, rx: 1.45, ry: 1.05, rz: 1.3 };

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
/**
 * The harvest moon: in the clear sky on the right, right of the windmill and under the header buttons, its whole disc
 * above the horizon. Its screen x depends on the window shape, because a wider window brings the windmill toward the centre.
 */
export const MOON_SCALE = 1.2;
export function moonSpot(aspect: number): { x: number; y: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const clear = clearSkyMoon(a, MOON_SCALE);
  // In a wide window the haunted house comes in from the right edge, so the moon moves in a little to stay clear of its roof.
  const wide = a > 16 / 9 ? Math.max(0.79, 0.875 - (Math.min(a, 2.4) - 16 / 9) * 0.15) : 1;
  return { x: Math.min(clear.x, wide), y: clear.y };
}
/** True when a point (screen fractions) is on the moon's disc, or within `pad` (window heights) of it. */
export function onMoon(sx: number, sy: number, aspect: number, pad = 0): boolean {
  const m = moonSpot(aspect);
  return Math.hypot((sx - m.x) * aspect, sy - m.y) < moonScreenRadiusScaled(aspect, MOON_SCALE).disc + pad;
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
    if (onMoon(s.cx, s.cy, aspect, s.ry + 0.02)) return `moon @${w}`;
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


export function buildTreePlan(seed: number): TreePlan {
  const rng = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const branches: Tube[] = [...LIMBS];
  // Twigs: short thin branches off the upper half of each limb, reaching out into the crown.
  for (const limb of LIMBS) {
    for (let k = 0; k < 3; k++) {
      const t = 0.45 + 0.18 * k + between(-0.04, 0.04);
      const p = curvePoint(limb.points, t);
      const out = Math.atan2(p[2] - CROWN.z, p[0] - CROWN.x) + between(-0.7, 0.7);
      const len = between(0.6, 1.0);
      const mid: V3 = [p[0] + Math.cos(out) * len * 0.5, p[1] + len * 0.3, p[2] + Math.sin(out) * len * 0.5];
      const tip: V3 = [p[0] + Math.cos(out) * len, p[1] + len * 0.6, p[2] + Math.sin(out) * len];
      const r0 = radiusAt(limb, t) * 0.55;
      branches.push({ points: [p, mid, tip], radii: [r0, r0 * 0.6, 0.03] });
    }
  }
  // The crown: clusters on and just inside the shell of the egg, thinner underneath so the limbs show.
  const clusters: LeafCluster[] = [];
  for (let i = 0; i < 1400 && clusters.length < 95; i++) {
    const u = between(-1, 1);
    const th = between(0, Math.PI * 2);
    const ring = Math.sqrt(1 - u * u);
    const shell = between(0.55, 1);
    const ux = ring * Math.cos(th);
    const uz = ring * Math.sin(th);
    // Fewer clusters low down: the underside is open.
    if (u < -0.35 && rng() < 0.75) continue;
    const r = between(0.42, 0.68);
    const x = CROWN.x + ux * CROWN.rx * shell;
    const y = CROWN.y + u * CROWN.ry * shell;
    const z = CROWN.z + uz * CROWN.rz * shell;
    if (!leavesFit(x, y, z, r)) continue;
    // Gold on top where the light falls, deep red underneath.
    const k = rng();
    const tone: LeafTone = u > 0.45 ? (k < 0.4 ? 'gold' : k < 0.8 ? 'orange' : 'red') : u < -0.2 ? (k < 0.5 ? 'deep' : 'red') : k < 0.5 ? 'red' : k < 0.85 ? 'orange' : 'gold';
    clusters.push({ x, y, z, r, tone, rotY: between(0, Math.PI * 2) });
  }
  // A small knot hole low on the trunk, facing the camera.
  const knotT = 0.35;
  const knotCentre = curvePoint(TRUNK.points, knotT);
  const knotR = radiusAt(TRUNK, knotT);
  const rotY = Math.atan2(0.5 - B.x, 16 - B.z);
  return {
    base: { x: B.x, z: B.z },
    trunk: TRUNK,
    branches,
    clusters,
    knot: { x: knotCentre[0] + Math.sin(rotY) * knotR * 1.02, y: knotCentre[1], z: knotCentre[2] + Math.cos(rotY) * knotR * 1.02, rotY, w: 0.13, h: 0.2 },
  };
}

// ---------- more autumn trees ----------
/** Where one more autumn tree stands: its foot on the ground, its size, which way it turns and how many leaf clusters it has. */
export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  seed: number;
  clusters: number;
}
/**
 * A tree like the big one (a short twisted trunk, four limbs, an egg of orange, red and gold leaves), moved, scaled and turned
 * to `spot`. Each limb point is nudged and the crown is a different size, so no two look copied. It makes no check against the
 * screen: the spots are chosen so that it clears the moon, the cards and the controls (`tests/house.test.ts` checks them).
 */
export function buildTreeVariant(spot: TreeSpot): TreePlan {
  const rng = mulberry32(spot.seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const cos = Math.cos(spot.rotY);
  const sin = Math.sin(spot.rotY);
  const s = spot.scale;
  const place = (p: V3, jitter: number): V3 => {
    const dx = (p[0] - B.x + between(-jitter, jitter)) * s;
    const dz = (p[2] - B.z + between(-jitter, jitter)) * s;
    return [spot.x + dx * cos + dz * sin, p[1] * s, spot.z - dx * sin + dz * cos];
  };
  const tube = (t: Tube, jitter: number, thin = 1): Tube => ({ points: t.points.map((p, i) => place(p, i === 0 ? 0 : jitter)), radii: t.radii.map((r) => r * s * thin) });
  const trunk = tube(TRUNK, 0.03);
  const limbs = LIMBS.map((l) => tube(l, 0.22, between(0.9, 1.1)));
  const cp = place([CROWN.x, CROWN.y, CROWN.z], 0);
  const crown = {
    x: cp[0], y: cp[1], z: cp[2],
    rx: CROWN.rx * s * between(0.85, 1.2),
    ry: CROWN.ry * s * between(0.85, 1.15),
    rz: CROWN.rz * s * between(0.85, 1.2),
  };
  const branches: Tube[] = [...limbs];
  for (const limb of limbs) {
    for (let k = 0; k < 2; k++) {
      const t = 0.5 + 0.22 * k + between(-0.05, 0.05);
      const p = curvePoint(limb.points, t);
      const out = Math.atan2(p[2] - crown.z, p[0] - crown.x) + between(-0.7, 0.7);
      const len = between(0.6, 1.0) * s;
      const mid: V3 = [p[0] + Math.cos(out) * len * 0.5, p[1] + len * 0.3, p[2] + Math.sin(out) * len * 0.5];
      const tip: V3 = [p[0] + Math.cos(out) * len, p[1] + len * 0.6, p[2] + Math.sin(out) * len];
      const r0 = radiusAt(limb, t) * 0.55;
      branches.push({ points: [p, mid, tip], radii: [r0, r0 * 0.6, 0.03 * s] });
    }
  }
  const clusters: LeafCluster[] = [];
  for (let i = 0; i < 1400 && clusters.length < spot.clusters; i++) {
    const u = between(-1, 1);
    const th = between(0, Math.PI * 2);
    const ring = Math.sqrt(1 - u * u);
    const shell = between(0.55, 1);
    if (u < -0.35 && rng() < 0.75) continue;
    const r = between(0.42, 0.68) * s;
    const k = rng();
    const tone: LeafTone = u > 0.45 ? (k < 0.4 ? 'gold' : k < 0.8 ? 'orange' : 'red') : u < -0.2 ? (k < 0.5 ? 'deep' : 'red') : k < 0.5 ? 'red' : k < 0.85 ? 'orange' : 'gold';
    clusters.push({ x: crown.x + ring * Math.cos(th) * crown.rx * shell, y: crown.y + u * crown.ry * shell, z: crown.z + ring * Math.sin(th) * crown.rz * shell, r, tone, rotY: between(0, Math.PI * 2) });
  }
  const knotT = 0.35;
  const c = curvePoint(trunk.points, knotT);
  const knotR = radiusAt(trunk, knotT);
  const face = Math.atan2(0.5 - spot.x, 16 - spot.z);
  return {
    base: { x: spot.x, z: spot.z },
    trunk,
    branches,
    clusters,
    knot: { x: c[0] + Math.sin(face) * knotR * 1.02, y: c[1], z: c[2] + Math.cos(face) * knotR * 1.02, rotY: face, w: 0.13 * s, h: 0.2 * s },
  };
}
// ---------- the trick-or-treater: a little witch ----------

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
/** The little witch's height, for the tests (the dry corn must be taller). */
export const KID_HEIGHT = 1.6;

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
  /** Green corn that fills the empty land of the fields. */
  fieldCorn: Stalk[];
  /** One list of posts for each side of the trail (left first). */
  fence: FencePost[][];
  tufts: Tuft[];
  leaves: FallenLeaf[];
  patches: LightPatch[];
  /** The smaller autumn trees around the haunted house and behind the corn (the big one on the left is `tree`). */
  extraTrees?: TreePlan[];
}

/** Where the fence stands, where the jack-o'-lanterns sit at its foot and where the dry corn starts, as distances from the trail's centre line. */
export const LANE = { jack: 1.95, fence: 2.5, corn: [3.1, 4.6] as const };
/** The lane runs along the trail between these z values. */
export const LANE_Z = { from: 8.5, to: -15.5 };
/** Nothing of the lane grows this close to the tree's trunk. */
const TREE_CLEAR = 2.3;
const nearTree = (x: number, z: number) => Math.hypot(x - TREE_FOOTPRINT.x, z - TREE_FOOTPRINT.z) < TREE_CLEAR;
/** Would a stalk this tall at this spot stand over the moon in some window? */
function overMoon(x: number, z: number, h: number): boolean {
  return FRAME_WINDOWS.some(([w, hh]) => {
    const cam = cameraAt(0, w / hh, true);
    return [h, h * 0.7, h * 0.4].some((y) => {
      const q = project([x, y, z], cam);
      return q !== null && onMoon(q.x, q.y, w / hh, 0.03);
    });
  });
}

/** Height of a field corn stalk at scale 1 (`buildFieldStalk`). */
export const FIELD_STALK_H = 2.3;
/** Field corn stays this far from the trail's centre line (the lane is the dry corn's) and inside these bounds. */
const FIELD = { keep: 5.4, minX: -27, maxX: 27, minZ: -42, maxZ: 3, step: 1.35 };
/** No field corn in front of the tree, so its trunk and roots stay in view. */
const inFrontOfTree = (x: number, z: number) => x > B.x - 3.2 && x < B.x + 4 && z > B.z - 1 && z < B.z + 9;
/**
 * Field corn on a jittered grid over the empty land: clear of the trail, every prop (wide margins round the barn, the silo
 * and the windmill), the reserved spots, the pumpkin patch on the right and the front of the tree, and never over the moon.
 */
export function buildFieldCorn(seed: number, line: readonly TrackPoint[], placements: readonly Placement[], reserved: readonly Footprint[], max = 420): Stalk[] {
  const rng = mulberry32(seed + 71);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const big = new Set(['farm_barn', 'farm_silo', 'farm_windmill']);
  const out: Stalk[] = [];
  const cams = FRAME_WINDOWS.map(([w, h]) => ({ aspect: w / h, cam: cameraAt(0, w / h, true) }));
  for (let z = FIELD.maxZ; z >= FIELD.minZ && out.length < max; z -= FIELD.step) {
    for (let x = FIELD.minX; x <= FIELD.maxX && out.length < max; x += FIELD.step) {
      const px = x + between(-0.45, 0.45);
      const pz = z + between(-0.45, 0.45);
      const scale = between(0.85, 1.2);
      if (line.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), Infinity) < FIELD.keep) continue;
      if (px > 3.5 && px < 12 && pz > -13 && pz < 8) continue;
      if (inFrontOfTree(px, pz)) continue;
      const f: Footprint = { x: px, z: pz, hx: 0.35, hz: 0.35, rotY: 0 };
      if (placements.some((p) => footprintsOverlap(f, footprintOf(p), big.has(p.model) ? 1.4 : 0.15))) continue;
      if (reserved.some((r) => footprintsOverlap(f, r, 0.3))) continue;
      const h = FIELD_STALK_H * scale;
      if (cams.some(({ aspect, cam }) => [h, h * 0.5].some((y) => {
        const q = project([px, y, pz], cam);
        return q !== null && onMoon(q.x, q.y, aspect, 0.03);
      }))) continue;
      const lean = between(0, 0.1);
      const dir = between(0, Math.PI * 2);
      out.push({ x: px, z: pz, y: 0, rotY: between(0, Math.PI * 2), scale, leanX: Math.cos(dir) * lean, leanZ: Math.sin(dir) * lean });
    }
  }
  return out;
}

export function buildAutumnPlan(seed: number, line: readonly TrackPoint[], placements: readonly Placement[] = [], reserved: readonly Footprint[] = []): AutumnPlan {
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
        if (nearTree(x, z) || overMoon(x, z, 2.6 * 1.3)) continue;
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
  // A carpet of leaves under the tree.
  for (let i = 0; i < 50; i++) {
    const a = between(0, Math.PI * 2);
    const d = Math.sqrt(rng()) * 2.4 + 0.5;
    leaves.push({ x: B.x + Math.cos(a) * d, z: B.z + Math.sin(a) * d, y: 0.04, rotY: between(0, Math.PI * 2), scale: between(0.7, 1.2), tone: tones[Math.floor(rng() * tones.length)]! });
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
    fieldCorn: buildFieldCorn(seed, line, placements, reserved),
    fence,
    tufts,
    leaves,
    patches,
  };
}

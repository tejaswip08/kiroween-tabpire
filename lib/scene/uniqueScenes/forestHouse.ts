// The witch's cottage of the Witch's Forest and the ground that fills the middle and the back of the scene, as pure data:
// where the house stands, the low mound under it, the far layers of small dead trees, the tree-line, stumps, fallen logs,
// crooked crosses, tombstones and rolling bumps. No three, no browser APIs. The drawing is in `themes/ForestHouse.tsx` and
// `themes/ForestMidground.tsx`. Coordinates: x right, y up, z toward the camera (the camera is at z = 16).
import type { Footprint } from '../layout';
import { mulberry32 } from '../rng';
import type { Grave, ScaryTree, Thorn } from './forestParts';
/**
 * Where the cottage stands: at the end of the trail, centre of the screen. It is far enough back (about 50 deep) to sit in the
 * band between the status row and the cards, and near enough to read as the focal point.
 */
export const WITCH_HOUSE = { x: 1.3, z: -34, rotY: -0.12, scale: 1.15 } as const;
/** The low mound the cottage stands on: half an ellipsoid on the ground (y = 0). */
export const MOUND = { rx: 6.2, rz: 4.8, h: 0.8 } as const;
/** The footing under the walls goes this low (a little below the mound top, so the walls never float). */
export const FOOTING_Y = 0.25;
/** The trail runs up to the door, which is this far in front of the middle of the house. */
export const DOOR_FRONT = 1.5;
/** The cottage and its yard keep this footprint free (nothing else stands on it). */
export const HOUSE_FOOTPRINT: Footprint = { x: WITCH_HOUSE.x, z: WITCH_HOUSE.z + 1.5, hx: 7.4, hz: 6.2, rotY: 0 };
/** The window of ground in front of the house that stays clear so the cottage is seen between the trees (x range, z range). */
export const HOUSE_LANE = { x: [-4.5, 7.5], z: [-60, -24] } as const;
/** The moon stands this deep behind the cottage, the far trees and the tree-line. */
export const MOON_DEPTH = 112;
/** Where the tree-line stands (z) and the band of ground fog (z). */
export const TREE_LINE_Z = -82;
export const FOG_BAND_Z = -62;
export interface Spot {
  x: number;
  z: number;
  rotY: number;
  scale: number;
}
/** A low rolling bump of the ground: half an ellipsoid. */
export interface Bump extends Spot {
  rx: number;
  rz: number;
  h: number;
}
/** One tree of the tree-line: a dark ragged cone. */
export interface LineTree {
  x: number;
  height: number;
  width: number;
}
export interface Midground {
  /** Two layers of smaller dead trees fading into the fog, behind the house and to both sides. */
  farTrees: ScaryTree[];
  /** Dead trees whose branches cross the moon. */
  moonTrees: ScaryTree[];
  lineTrees: LineTree[];
  stumps: Spot[];
  logs: Thorn[];
  graves: Grave[];
  bumps: Bump[];
}
/** Triangle bounds of the parts above, for the budget. */
export const BUMP_TRIS = 100;
export const STUMP_TRIS = 60;
export const LINE_TREE_TRIS = 14;
export const HOUSE_TRIS = 1800;
/** Triangles of one far tree (see `buildFarTree`). */
export const FAR_TREE_TRIS = 130;
export const FOREST_MID_CALLS = 18;
export const FAR_TREE_COUNT = [16, 22] as const;
export const BUMP_COUNT = 14;
const dist = (path: readonly { x: number; z: number }[], x: number, z: number) => path.reduce((m, c) => Math.min(m, Math.hypot(c.x - x, c.z - z)), Infinity);
/**
 * Fills the flat ground between the foreground and the horizon. Seeded. Nothing stands on the path, on the keep-out footprints
 * or in front of the house, and the stumps, logs and crosses stay low.
 */
export function forestMidground(path: readonly { x: number; z: number }[], halfWidth: number, keepOut: readonly Footprint[]): Midground {
  const rng = mulberry32(60217);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const clear = (x: number, z: number, r: number) =>
    dist(path, x, z) > halfWidth + r + 0.8 && keepOut.every((f) => Math.hypot(f.x - x, f.z - z) > Math.max(f.hx, f.hz) + r + 0.2);
  const inLane = (x: number, z: number, pad = 0) => x > HOUSE_LANE.x[0] - pad && x < HOUSE_LANE.x[1] + pad && z > HOUSE_LANE.z[0] && z < HOUSE_LANE.z[1];
  // Two layers of smaller dead trees, behind and beside the house. The lane right behind the house is left open for the moon.
  const farTrees: ScaryTree[] = [];
  const layers: readonly [readonly [number, number], number][] = [[[-62, -42], FAR_TREE_COUNT[0]], [[-76, -60], FAR_TREE_COUNT[1]]];
  layers.forEach(([[z0, z1], count], layer) => {
    for (let n = 0; n < count * 20 && farTrees.filter((t) => t.z <= z1 && t.z >= z0).length < count; n++) {
      const x = between(-52, 56);
      const z = between(z0, z1);
      if (inLane(x, z, 3.5) || Math.abs(x - WITCH_HOUSE.x) < 9) continue;
      const scale = between(0.55, 0.85) * (layer === 1 ? 1.1 : 1);
      if (farTrees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
      farTrees.push({ x, z, rotY: between(0, Math.PI * 2), scale, variant: farTrees.length % 3 });
    }
  });
  // A few taller bare trees stand in front of the moon, off to its sides, so their black branches cross the disc.
  const moonTrees: ScaryTree[] = [
    { x: -0.6, z: -58, rotY: 0.6, scale: 1.55, variant: 1 },
    { x: 7.2, z: -61, rotY: 2.4, scale: 1.6, variant: 2 },
    { x: 3.2, z: -72, rotY: 4.1, scale: 1.5, variant: 0 },
  ];
  // The tree-line: a ragged row of dark cones along the far edge.
  const lineTrees: LineTree[] = [];
  for (let x = -140; x <= 150; x += 3.6) lineTrees.push({ x: x + between(-0.9, 0.9), height: between(3, 6.4), width: between(2.2, 3.6) });
  // Stumps and fallen logs in the middle ground, to both sides of the trail.
  const stumps: Spot[] = [];
  for (let n = 0; n < 400 && stumps.length < 12; n++) {
    const x = between(-18, 18);
    const z = between(-34, -6);
    if (!clear(x, z, 0.9) || inLane(x, z) || stumps.some((s) => Math.hypot(s.x - x, s.z - z) < 3)) continue;
    stumps.push({ x, z, rotY: between(0, Math.PI * 2), scale: between(0.7, 1.4) });
  }
  const logs: Thorn[] = [];
  for (let n = 0; n < 400 && logs.length < 6; n++) {
    const x = between(-20, 20);
    const z = between(-36, -8);
    if (!clear(x, z, 1.8) || inLane(x, z) || stumps.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5) || logs.some((l) => Math.hypot(l.x - x, l.z - z) < 4)) continue;
    logs.push({ x, z, rotY: between(0, Math.PI * 2), scale: between(0.8, 1.3) });
  }
  // Little groups of crooked crosses and small tombstones.
  const graves: Grave[] = [];
  const groupAt: [number, number][] = [[-9, -24], [11, -22], [-15, -33], [16, -34], [-5, -17], [8, -14]];
  for (const [gx, gz] of groupAt) {
    const count = 3 + Math.floor(rng() * 2);
    for (let n = 0; n < count * 30 && graves.filter((g) => Math.hypot(g.x - gx, g.z - gz) < 3.4).length < count; n++) {
      const x = gx + between(-2.4, 2.4);
      const z = gz + between(-1.8, 1.8);
      if (!clear(x, z, 0.6) || inLane(x, z) || stumps.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6) || logs.some((l) => Math.hypot(l.x - x, l.z - z) < 2.4) || graves.some((g) => Math.hypot(g.x - x, g.z - z) < 1.3)) continue;
      graves.push({ kind: rng() < 0.55 ? 'cross' : 'stone', x, z, rotY: between(0, Math.PI * 2), tilt: (rng() < 0.5 ? -1 : 1) * between(0.1, 0.3), scale: between(0.85, 1.25) });
    }
  }
  // Low rolling bumps, so the ground is not a flat plane. They keep off the trail and the house.
  const bumps: Bump[] = [];
  for (let n = 0; n < 600 && bumps.length < BUMP_COUNT; n++) {
    const x = between(-46, 48);
    const z = between(-70, -8);
    const rx = between(4, 9);
    const rz = between(3, 6);
    if (dist(path, x, z) < halfWidth + rx + 0.5 || Math.hypot(x - WITCH_HOUSE.x, z - WITCH_HOUSE.z) < 12 + rx || keepOut.some((f) => Math.hypot(f.x - x, f.z - z) < Math.max(f.hx, f.hz) + rx * 0.7)) continue;
    if (bumps.some((b) => Math.hypot(b.x - x, b.z - z) < (b.rx + rx) * 0.55)) continue;
    bumps.push({ x, z, rotY: between(0, Math.PI), scale: 1, rx, rz, h: between(0.45, 1.1) });
  }
  return { farTrees, moonTrees, lineTrees, stumps, logs, graves, bumps };
}
/** Triangles of the midground's own parts (an upper bound), for the budget. */
export const midgroundTris = (m: Midground, graveTris: number, logTris: number): number =>
  (m.farTrees.length + m.moonTrees.length) * FAR_TREE_TRIS + m.lineTrees.length * LINE_TREE_TRIS + m.stumps.length * STUMP_TRIS + m.logs.length * logTris + m.graves.length * graveTris + m.bumps.length * BUMP_TRIS + HOUSE_TRIS;

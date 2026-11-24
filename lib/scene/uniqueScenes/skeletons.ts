// The skeletons of the Pumpkin Patch. Pure: no three, no browser APIs.
// What they mean (Requirement 7: nothing spooky is decoration only):
// - The skeletons clawing out of the ground rise with hunger: with calm tabs only their hands and the top of a skull show;
//   the more tabs are starving, the further they climb out (up to the hips).
// - The skulls on the fence posts count the tabs you have staked: a few are always there, and each staked tab adds one.
// - Two skeletons strung up on posts like scarecrows, and one slumped against the old tree, guard the farm.
import { TREE_BASE } from './autumn';
import type { Footprint } from '../layout';

export interface SkeletonSpot {
  x: number;
  z: number;
  rotY: number;
  scale: number;
}
/** Turned to face the camera (which is at x 0.5, z 16), plus a small twist. */
const facing = (x: number, z: number, twist = 0): number => Math.atan2(0.5 - x, 16 - z) + twist;
const spot = (x: number, z: number, scale: number, twist = 0): SkeletonSpot => ({ x, z, rotY: facing(x, z, twist), scale });

/** Strung up on a post with a crossbar: one in the clearing between the lane and the tree, one at the back of the pumpkin patch. */
export const HUNG: readonly SkeletonSpot[] = [spot(-6.3, 1.6, 1.05, 0.15), spot(8.4, -7.4, 1.1, -0.2)];
/** Slumped against the tree trunk, legs out toward the camera, on its right-hand side. */
export const SITTING: SkeletonSpot = spot(TREE_BASE.x + 0.75, TREE_BASE.z + 0.85, 1.05, -0.35);
/** Clawing out of dirt mounds: three in the pumpkin patch and one in the clearing by the tree. */
export const RISING: readonly SkeletonSpot[] = [
  spot(5.6, -2.6, 1.05, 0.25),
  spot(7.4, 3.6, 1.1, -0.3),
  spot(6.0, 6.2, 0.95, 0.1),
  spot(-5.7, 4.6, 1.0, 0.3),
];
/** Bones lying in the grass: x, z, turn, scale. */
export const LOOSE_BONES: readonly [number, number, number, number][] = [
  [-7.2, 0.4, 0.6, 1], [-6.6, 3.0, 2.1, 0.9], [6.6, -1.2, 1.2, 1.1], [6.9, 4.5, 2.8, 0.9], [5.8, 1.6, 0.3, 1], [-7.6, -0.1, 1.9, 0.8],
];

/** Footprints kept clear for the skeletons, so pumpkins, hay and corn never stand in them. */
export function skeletonFootprints(): Footprint[] {
  return [
    ...HUNG.map((h) => ({ x: h.x, z: h.z, hx: 1.0 * h.scale, hz: 0.45, rotY: h.rotY })),
    ...RISING.map((r) => ({ x: r.x, z: r.z, hx: 0.75 * r.scale, hz: 0.75 * r.scale, rotY: 0 })),
    ...LOOSE_BONES.map(([x, z]) => ({ x, z, hx: 0.3, hz: 0.3, rotY: 0 })),
  ];
}

/** Heights (scale 1) of the parts, for the moon and budget checks. */
export const HUNG_HEIGHT = 2.95;

/** How far the rising skeletons are out of the ground, 0 (hands and a skull top) to 1 (out to the hips), from the ember rate. */
export const RISE_MIN = 0.3;
export function riseAmount(emberRate: number): number {
  // `emberRate` goes from 0.15 (nothing starving) to 1 (12 or more starving tabs): see `EMBERS` in meaning.ts.
  const k = Number.isFinite(emberRate) ? (emberRate - 0.15) / 0.85 : 0;
  return RISE_MIN + (1 - RISE_MIN) * Math.min(1, Math.max(0, k));
}
/** The rising skeleton's local origin (its pelvis) is this far below the ground at `riseAmount` 0 and 1. */
export const RISE_DEPTH = { buried: -0.95, out: -0.05 };
export const riseOffset = (k: number): number => RISE_DEPTH.buried + (RISE_DEPTH.out - RISE_DEPTH.buried) * k;

/** Skulls always on the fence posts, and how many show for a number of staked tabs (a smooth number), up to `posts`. */
export const BASE_SKULLS = 4;
export const skullsShown = (staked: number, posts: number): number =>
  Math.min(posts, BASE_SKULLS + Math.max(0, Number.isFinite(staked) ? staked : 0));

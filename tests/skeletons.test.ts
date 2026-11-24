// The skeletons of the Pumpkin Patch: where they stand, what they mean, and what they cost.
import { describe, expect, it } from 'vitest';
import { trianglesOf } from '../entrypoints/newtab/layers/scene/themes/autumnBuild';
import { skullPosts } from '../entrypoints/newtab/layers/scene/themes/PumpkinSkeletons';
import {
  buildBoneyard, buildHungSkeleton, buildPostSkull, buildRisingSkeleton, buildSittingSkeleton,
} from '../entrypoints/newtab/layers/scene/themes/skeletonBuild';
import { cameraAt, project } from '../lib/scene/camera';
import { EMBERS, sceneState } from '../lib/scene/meaning';
import { themeScene } from '../lib/scene/themeLayout';
import { footprintOf, footprintsOverlap } from '../lib/scene/layout';
import { FRAME_WINDOWS, TREE_BASE, onMoon } from '../lib/scene/uniqueScenes/autumn';
import { PUMPKIN_PARTS } from '../lib/scene/uniqueScenes/pumpkin';
import {
  BASE_SKULLS, HUNG, HUNG_HEIGHT, LOOSE_BONES, RISE_DEPTH, RISE_MIN, RISING, SITTING, riseAmount, riseOffset, skeletonFootprints, skullsShown,
} from '../lib/scene/uniqueScenes/skeletons';
import { distToPath } from '../lib/scene/uniqueScenes/types';

const spec = themeScene('pumpkin').unique!;
const plan = spec.autumn!;
const inputs = { cardCount: 10, starvingCount: 0, estimatedMb: 500, cryptCount: 0, crypted: 0, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false };

describe('what the skeletons mean', () => {
  it('rise out of the ground with hunger: hands and a skull top when calm, out to the hips at 12 starving tabs', () => {
    const calm = riseAmount(sceneState({ ...inputs, starvingCount: 0 }).emberRate);
    const some = riseAmount(sceneState({ ...inputs, starvingCount: 5 }).emberRate);
    const full = riseAmount(sceneState({ ...inputs, starvingCount: EMBERS.fullAtStarving }).emberRate);
    expect(calm).toBeCloseTo(RISE_MIN, 9);
    expect(some).toBeGreaterThan(calm);
    expect(full).toBe(1);
    expect(riseAmount(Number.NaN)).toBe(RISE_MIN);
    // Hunger never sinks them while it grows.
    let last = -1;
    for (let n = 0; n <= 20; n++) {
      const k = riseAmount(sceneState({ ...inputs, cardCount: 20, starvingCount: n }).emberRate);
      expect(k).toBeGreaterThanOrEqual(last);
      last = k;
    }
    // When calm the skull top (about 0.87 above the pelvis) just shows; at full hunger the pelvis is at the ground.
    expect(riseOffset(RISE_MIN) + 0.87).toBeGreaterThan(0);
    expect(riseOffset(RISE_MIN) + 0.55).toBeLessThan(0);
    expect(riseOffset(1)).toBeCloseTo(RISE_DEPTH.out, 9);
  });
  it('put a skull on a fence post for every staked tab, on top of the ones always there, up to the posts', () => {
    const posts = plan.fence.flat().length;
    expect(posts).toBeGreaterThan(BASE_SKULLS + 6);
    expect(skullsShown(0, posts)).toBe(BASE_SKULLS);
    expect(skullsShown(3, posts)).toBe(BASE_SKULLS + 3);
    expect(skullsShown(999, posts)).toBe(posts);
    expect(skullsShown(Number.NaN, posts)).toBe(BASE_SKULLS);
    expect(skullsShown(sceneState({ ...inputs, staked: 2 }).newGraves, posts)).toBe(BASE_SKULLS + 2);
  });
  it('shows the first skulls on the posts nearest the camera, on both sides', () => {
    const order = skullPosts(plan.fence);
    expect(order).toHaveLength(plan.fence.flat().length);
    const first = order.slice(0, BASE_SKULLS);
    const near = Math.max(...plan.fence.flat().map((f) => f.z));
    expect(Math.max(...first.map((f) => f.z))).toBe(near);
    expect(first.some((f) => plan.fence[0]!.includes(f)) && first.some((f) => plan.fence[1]!.includes(f))).toBe(true);
  });
});

describe('where the skeletons are', () => {
  it('keep off the trail, out of the props, and in view', () => {
    for (const s of [...HUNG, ...RISING, SITTING]) {
      expect(distToPath(spec.path.centre, s.x, s.z), `${s.x},${s.z}`).toBeGreaterThan(4.8);
      for (const [w, h] of FRAME_WINDOWS) {
        const q = project([s.x, 0.6, s.z], cameraAt(0, w / h, true))!;
        expect(q.x, `${s.x},${s.z} @${w}`).toBeGreaterThan(0.02);
        expect(q.x).toBeLessThan(0.98);
        expect(q.y).toBeLessThan(0.97);
      }
    }
    for (const f of skeletonFootprints()) {
      for (const p of spec.placements) expect(footprintsOverlap(f, footprintOf(p), 0), `${p.id} on a skeleton at ${f.x},${f.z}`).toBe(false);
      for (const c of plan.fieldCorn) expect(Math.hypot(c.x - f.x, c.z - f.z) > Math.max(f.hx, f.hz) * 0.9, 'field corn on a skeleton').toBe(true);
    }
  });
  it('slumps one skeleton against the tree trunk', () => {
    expect(Math.hypot(SITTING.x - TREE_BASE.x, SITTING.z - TREE_BASE.z)).toBeLessThan(1.3);
    expect(SITTING.z).toBeGreaterThan(TREE_BASE.z);
  });
  it('never stands over the moon', () => {
    for (const [w, h] of FRAME_WINDOWS) {
      const cam = cameraAt(0, w / h, true);
      for (const s of HUNG) {
        for (const y of [HUNG_HEIGHT * s.scale, 2.3 * s.scale]) {
          for (const dx of [-1, 0, 1]) {
            const q = project([s.x + dx, y, s.z], cam)!;
            expect(onMoon(q.x, q.y, w / h, 0.02), `${s.x} @${w}`).toBe(false);
          }
        }
      }
    }
  });
  it('lays loose bones in the grass, off the trail', () => {
    for (const [x, z] of LOOSE_BONES) expect(distToPath(spec.path.centre, x, z)).toBeGreaterThan(spec.path.halfWidth);
  });
});

describe('the skeleton shapes', () => {
  it('are one mesh with a bone part and a glowing-eye part each', () => {
    for (const g of [buildHungSkeleton(), buildSittingSkeleton(), buildRisingSkeleton(), buildPostSkull()]) {
      expect(g.groups.map((x) => x.materialIndex)).toEqual([0, 1]);
      // Two eyes.
      expect(g.groups[1]!.count).toBeGreaterThan(0);
    }
    const hung = buildHungSkeleton();
    hung.computeBoundingBox();
    expect(hung.boundingBox!.max.y).toBeCloseTo(HUNG_HEIGHT, 1);
    const rising = buildRisingSkeleton();
    rising.computeBoundingBox();
    // Hands reach up over the head.
    expect(rising.boundingBox!.max.y).toBeGreaterThan(1);
  });
  it('fit in the triangles and draw calls the plan counts', () => {
    const tris =
      trianglesOf(buildHungSkeleton()) * HUNG.length + trianglesOf(buildSittingSkeleton()) + trianglesOf(buildRisingSkeleton()) * RISING.length +
      trianglesOf(buildPostSkull()) * plan.fence.flat().length + trianglesOf(buildBoneyard(RISING, LOOSE_BONES));
    expect(tris).toBeLessThanOrEqual(PUMPKIN_PARTS.skeletonTris);
    expect(spec.extras.tris).toBeGreaterThanOrEqual(PUMPKIN_PARTS.autumnTris + PUMPKIN_PARTS.skeletonTris);
  });
});

import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { buildTreeLeaves, buildTreeWood, trianglesOf } from '../entrypoints/newtab/layers/scene/themes/autumnBuild';
import { buildHouse } from '../entrypoints/newtab/layers/scene/themes/houseBuild';
import { flicker } from '../entrypoints/newtab/layers/scene/themes/HauntedHouse';
import { ballBlocks, buildTreeVariant, tubeBalls } from '../lib/scene/uniqueScenes/autumn';
import { FLOOR_Y, FOOTING_Y, FOOTPRINT, HILL, HOUSE, hillHeightAt, houseCoversMoon, houseOnScreen } from '../lib/scene/uniqueScenes/house';
import { BARN, EXTRA_TREE_SPOTS, PUMPKIN_PARTS, WINDMILL, buildPumpkinPatch } from '../lib/scene/uniqueScenes/pumpkin';
import { FRAME_WINDOWS } from '../lib/scene/uniqueScenes/autumn';

const spec = buildPumpkinPatch(1);
const house = buildHouse();

describe('the haunted house', () => {
  it('stands on a hill that sits on the ground, with its footing inside the hill', () => {
    house.body.computeBoundingBox();
    // The hill's base is the lowest point, FLOOR_Y below the floor: after the group is lifted by FLOOR_Y it is on the ground (y = 0).
    expect(house.body.boundingBox!.min.y).toBeCloseTo(-FLOOR_Y, 5);
    expect(FLOOR_Y * HOUSE.scale + house.body.boundingBox!.min.y * HOUSE.scale).toBeCloseTo(0, 5);
    // The footing starts below the floor, and every corner of what stands on the hill is on the hill, below the floor level.
    expect(FOOTING_Y).toBeLessThan(FLOOR_Y);
    for (const x of [FOOTPRINT.x0, FOOTPRINT.x1]) for (const z of [FOOTPRINT.z0, FOOTPRINT.z1]) expect(hillHeightAt(x, z)).toBeGreaterThan(FLOOR_Y + 0.1);
    expect(HILL.h).toBeGreaterThan(FLOOR_Y);
  });
  it('is tall and narrow: two storeys under a steep roof, with a tower taller than the walls', () => {
    const b = new Box3().setFromBufferAttribute(house.body.getAttribute('position') as never);
    expect(b.max.y).toBeGreaterThan(7);
    expect(FOOTPRINT.x1 - FOOTPRINT.x0).toBeLessThan(HILL.rx);
  });
  it('has four lit windows in two groups, one of them round', () => {
    expect(trianglesOf(house.panesA)).toBe(2 * 12);
    // Two boxes in A; a box and a circle (10 triangles) in B.
    expect(trianglesOf(house.panesB)).toBe(12 + 10);
  });
  it('flickers slowly but never goes dark', () => {
    for (let t = 0; t < 60; t += 0.1) {
      const f = flicker(t, 0);
      expect(f).toBeGreaterThan(0.65);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
  it('keeps clear of the moon and the header in every window, and is on screen', () => {
    expect(houseCoversMoon(0.01)).toBe(false);
    for (const [w, h] of FRAME_WINDOWS) {
      const parts = houseOnScreen(w / h)!;
      expect(parts).not.toBeNull();
      const x0 = Math.min(...parts.map((p) => p.x0));
      const x1 = Math.max(...parts.map((p) => p.x1));
      const y0 = Math.min(...parts.map((p) => p.y0));
      // Right of the windmill, partly on screen, and below the buttons at the top.
      expect(x1).toBeGreaterThan(0.85);
      expect(x0).toBeLessThan(1);
      expect(y0).toBeGreaterThan(0.2);
    }
  });
  it('is between the windmill and the right edge', () => {
    expect(HOUSE.x).toBeGreaterThan(WINDMILL.x + 6);
  });
});

describe('the extra autumn trees', () => {
  const plans = EXTRA_TREE_SPOTS.map(buildTreeVariant);
  it('has four, each its own size and turn', () => {
    expect(plans).toHaveLength(4);
    expect(new Set(EXTRA_TREE_SPOTS.map((t) => t.scale)).size).toBe(4);
    expect(new Set(EXTRA_TREE_SPOTS.map((t) => t.rotY)).size).toBe(4);
    expect(new Set(plans.map((p) => p.clusters.length)).size).toBe(4);
    expect(spec.autumn!.extraTrees).toHaveLength(4);
  });
  it('are in the orange, red and gold palette', () => {
    for (const p of plans) expect(new Set(p.clusters.map((c) => c.tone)).size).toBeGreaterThanOrEqual(3);
  });
  it('keep clear of the moon, the cards and the controls in every window', () => {
    for (const p of plans) {
      for (const c of p.clusters) expect(ballBlocks(c.x, c.y, c.z, c.r, false)).toBeNull();
      for (const t of [p.trunk, ...p.branches]) for (const b of tubeBalls(t, 6)) expect(ballBlocks(b.x, b.y, b.z, b.r, false)).toBeNull();
    }
  });
  it('stand on the ground, clear of the barn and the house', () => {
    for (const [i, t] of EXTRA_TREE_SPOTS.entries()) {
      expect(plans[i]!.trunk.points[0]![1]).toBeLessThan(0);
      expect(Math.hypot(t.x - BARN.x, t.z - BARN.z)).toBeGreaterThan(15);
      const onHill = ((t.x - HOUSE.x) / (HILL.rx * HOUSE.scale)) ** 2 + ((t.z - HOUSE.z) / (HILL.rz * HOUSE.scale)) ** 2;
      expect(onHill).toBeGreaterThan(1);
    }
  });
  it('are behind the corn field or beside the house', () => {
    const behind = EXTRA_TREE_SPOTS.filter((t) => t.z < -42);
    expect(behind.length).toBeGreaterThanOrEqual(1);
    expect(EXTRA_TREE_SPOTS.some((t) => Math.abs(t.x - HOUSE.x) < 8 && t.z < -20)).toBe(true);
    expect(EXTRA_TREE_SPOTS.some((t) => t.x > HOUSE.x + 3)).toBe(true);
  });
});

describe('the budget', () => {
  it('fits the triangles and draw calls the plan counts', () => {
    const tris = trianglesOf(house.body) + trianglesOf(house.panesA) + trianglesOf(house.panesB);
    expect(tris).toBeLessThanOrEqual(PUMPKIN_PARTS.houseTris);
    const trees = spec.autumn!.extraTrees!.reduce((n, p) => n + trianglesOf(buildTreeWood(p)) + trianglesOf(buildTreeLeaves(p.clusters)), 0);
    expect(trees).toBeLessThanOrEqual(PUMPKIN_PARTS.extraTreeTris);
    expect(PUMPKIN_PARTS.houseCalls).toBe(3 + 4 * 2);
  });
  it('does not move the props that were already placed', () => {
    expect(spec.placements.some((p) => p.model === 'farm_barn')).toBe(true);
    expect(spec.reserved.length).toBeGreaterThan(0);
  });
});

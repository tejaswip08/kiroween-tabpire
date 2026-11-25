// The witch's cottage and the filled middle ground of the Witch's Forest: the house is grounded, in view between the status row and
// the cards, and the things around it keep off the trail and the house lane.
import { moonScreenRadiusScaled } from '../lib/scene/sky';
import { Box3, Matrix4, Quaternion, Vector3, Euler } from 'three';
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { themeScene } from '../lib/scene/themeLayout';
import { FOREST_MOON } from '../lib/scene/uniqueScenes/forest';
import { HOUSE_LANE, MOUND, WITCH_HOUSE } from '../lib/scene/uniqueScenes/forestHouse';
import { VIEW_ASPECTS, distToPath } from '../lib/scene/uniqueScenes/types';
import { flickerOf } from '../entrypoints/newtab/layers/scene/themes/ForestHouse';
import { HOUSE_PARTS, buildBump, buildFarTree, buildStump, buildWitchHouse, trianglesOfShape } from '../entrypoints/newtab/layers/scene/themes/witchHouseShapes';
const spec = themeScene('forest').unique!;
const mid = spec.forest!.mid;
const place = (g: ReturnType<typeof buildWitchHouse>) => {
  const m = new Matrix4().compose(new Vector3(WITCH_HOUSE.x, 0, WITCH_HOUSE.z), new Quaternion().setFromEuler(new Euler(0, WITCH_HOUSE.rotY, 0)), new Vector3(WITCH_HOUSE.scale, WITCH_HOUSE.scale, WITCH_HOUSE.scale));
  g.computeBoundingBox();
  return g.boundingBox!.clone().applyMatrix4(m);
};
describe("the witch's house", () => {
  it('stands firmly on the ground: its lowest point is the ground, and its footing is buried in the mound', () => {
    const box = place(buildWitchHouse());
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.min.y).toBeLessThanOrEqual(0.02);
    expect(HOUSE_PARTS.height).toBeGreaterThan(5);
    expect(box.max.y).toBeLessThan(9);
    // The windows and the lantern are above the mound, never inside it.
    for (const w of HOUSE_PARTS.windows) expect(w.y - w.size / 2).toBeGreaterThan(MOUND.h * 0.85);
  });
  it('is at the end of the trail, centred, and in view between the status row and the cards at every window shape', () => {
    const end = spec.path.centre[spec.path.centre.length - 1]!;
    expect(Math.hypot(end.x - WITCH_HOUSE.x, end.z - (WITCH_HOUSE.z + 1.5 * WITCH_HOUSE.scale))).toBeLessThan(1.6);
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      const base = project([WITCH_HOUSE.x, 0, WITCH_HOUSE.z], cam)!;
      const top = project([WITCH_HOUSE.x, HOUSE_PARTS.height * WITCH_HOUSE.scale, WITCH_HOUSE.z], cam)!;
      expect(base.x).toBeGreaterThan(0.45);
      expect(base.x).toBeLessThan(0.6);
      // The cards start near 0.55 and the status row is near 0.33 of the window height.
      expect(base.y).toBeLessThan(0.52);
      expect(top.y).toBeGreaterThan(0.25);
      expect(top.y).toBeLessThan(0.36);
    }
  });
  it('never covers the moon, which is now in the clear sky of the upper right corner', () => {
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      const t = FOREST_MOON.target(aspect);
      const top = project([WITCH_HOUSE.x, HOUSE_PARTS.height * WITCH_HOUSE.scale, WITCH_HOUSE.z], cam)!;
      // The roof top is far left of the disc.
      expect(t.x - top.x - moonScreenRadiusScaled(aspect, FOREST_MOON.scale).disc / aspect).toBeGreaterThan(0.1);
    }
  });
  it('flickers slowly and never goes dark; reduced motion holds it steady', () => {
    for (let t = 0; t < 60; t += 0.37) {
      const f = flickerOf(t, 1.3, false);
      expect(f).toBeGreaterThan(0.6);
      expect(f).toBeLessThan(1.2);
    }
    expect(flickerOf(12, 1, true)).toBe(1);
  });
});
describe('the filled middle ground', () => {
  const lane = (x: number, z: number) => x > HOUSE_LANE.x[0] && x < HOUSE_LANE.x[1] && z > HOUSE_LANE.z[0] && z < HOUSE_LANE.z[1];
  it('keeps stumps, logs, crosses and bumps off the trail and the lane to the house', () => {
    for (const s of [...mid.stumps, ...mid.logs, ...mid.graves]) {
      expect(distToPath(spec.path.centre, s.x, s.z)).toBeGreaterThan(1.5);
      expect(lane(s.x, s.z)).toBe(false);
    }
    for (const b of mid.bumps) expect(distToPath(spec.path.centre, b.x, b.z)).toBeGreaterThan(1.5 + b.rx);
  });
  it('has two layers of smaller far trees, tree-line, stumps, logs, grave groups and rolling bumps', () => {
    expect(mid.farTrees.length).toBeGreaterThan(20);
    expect(mid.farTrees.some((t) => t.z < -60)).toBe(true);
    expect(mid.farTrees.some((t) => t.z > -60)).toBe(true);
    expect(mid.lineTrees.length).toBeGreaterThan(30);
    expect(mid.stumps.length).toBeGreaterThanOrEqual(6);
    expect(mid.logs.length).toBeGreaterThanOrEqual(3);
    expect(mid.graves.length).toBeGreaterThanOrEqual(8);
    expect(mid.bumps.length).toBeGreaterThanOrEqual(8);
    expect(spec.models).toContain('forest_rock_large');
    expect(spec.models).toContain('forest_rocks');
  });
  it('builds cheap shapes that stand on the ground', () => {
    for (const v of [0, 1, 2]) {
      const g = buildFarTree(v);
      g.computeBoundingBox();
      expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.05);
      expect(trianglesOfShape(g)).toBeLessThanOrEqual(130);
    }
    const stump = buildStump();
    stump.computeBoundingBox();
    expect(stump.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.05);
    const bump = new Box3().setFromBufferAttribute(buildBump().getAttribute('position') as never);
    expect(bump.min.y).toBeGreaterThanOrEqual(-0.001);
  });
});

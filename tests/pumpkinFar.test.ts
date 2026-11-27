import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { trianglesOf } from '../entrypoints/newtab/layers/scene/themes/autumnBuild';
import { buildPumpkinFarShapes, mistBands } from '../entrypoints/newtab/layers/scene/themes/pumpkinFarBuild';
import { footprintOf, footprintsOverlap } from '../lib/scene/layout';
import { moonScreenRadiusScaled } from '../lib/scene/sky';
import { FRAME_WINDOWS, MOON_SCALE, moonSpot, uiRects } from '../lib/scene/uniqueScenes/autumn';
import { buildPumpkinPatch } from '../lib/scene/uniqueScenes/pumpkin';
import {
  DUSK_CLOUDS, DUSK_DISTANCE, DUSK_LAYERS, DUSK_PUFFS, duskPuffCount, FAR_HEIGHT, FAR_PARTS, buildPumpkinFar, duskOnMoon, duskPuffsOnScreen, farFootprints, farThings, topOnScreen,
} from '../lib/scene/uniqueScenes/pumpkinFar';

const far = buildPumpkinFar(1);
const shapes = buildPumpkinFarShapes(far);
const windows = FRAME_WINDOWS.map(([w, h]) => ({ w, h, a: w / h }));

describe('the Pumpkin Patch far scenery', () => {
  it('is the same on every load', () => {
    expect(buildPumpkinFar(1)).toEqual(far);
    expect(buildPumpkinFar(2)).not.toEqual(far);
  });
  it('has every layer: hills, farmhouses, steeple, water tower, village, dead trees with crows, autumn trees, scarecrows, fence, wagon, hay, well, shed and mist', () => {
    expect(far.hills.length).toBeGreaterThanOrEqual(5);
    expect(far.farmhouses.length).toBe(2);
    expect(far.village.length).toBeGreaterThanOrEqual(6);
    expect(far.deadTrees.length).toBeGreaterThanOrEqual(6);
    expect(far.deadTrees.some((t) => t.crows > 0)).toBe(true);
    expect(new Set(far.deadTrees.map((t) => t.scale.toFixed(1))).size).toBeGreaterThan(3);
    expect(far.autumnTrees.length).toBeGreaterThanOrEqual(4);
    expect(far.scarecrows.length).toBeGreaterThanOrEqual(3);
    expect(far.fence.length).toBeGreaterThanOrEqual(8);
    expect(far.hayStacks.length).toBeGreaterThanOrEqual(2);
    expect(far.mist.length).toBeGreaterThanOrEqual(3);
  });
  it('fills both sides: far things left of the barn and right of the windmill', () => {
    const xs = farThings(far).map(({ t }) => t.x);
    expect(xs.filter((x) => x < -15).length).toBeGreaterThanOrEqual(8);
    expect(xs.filter((x) => x > 15).length).toBeGreaterThanOrEqual(8);
    expect(xs.filter((x) => x > -2 && x < 15).length).toBeGreaterThanOrEqual(4);
  });
  it('stands on the ground, far behind the lane, inside the 200 x 200 ground', () => {
    for (const { t } of farThings(far)) {
      expect(Math.abs(t.x)).toBeLessThan(95);
      expect(t.z).toBeLessThan(-33);
      expect(t.z).toBeGreaterThan(-98);
    }
    for (const h of far.hills) expect(h.z - h.rz).toBeGreaterThan(-106);
  });
  it('keeps off every prop of the scene and the fill', () => {
    const spec = buildPumpkinPatch(1);
    const feet = farFootprints(far);
    const others = [...spec.placements, ...(spec.fill?.placements ?? [])].map(footprintOf);
    for (const f of feet) for (const o of [...others, ...spec.reserved]) expect(footprintsOverlap(f, o)).toBe(false);
  });
  it('never covers the moon and leaves clear sky under it', () => {
    for (const { a } of windows) {
      const m = moonSpot(a);
      const r = moonScreenRadiusScaled(a, MOON_SCALE).disc;
      for (const { kind, t } of farThings(far)) {
        const p = topOnScreen(t.x, FAR_HEIGHT[kind] * t.scale, t.z, a)!;
        if (Math.abs(p.x - m.x) * a < r + 0.03) expect(p.y, kind).toBeGreaterThan(m.y + r + 0.025);
      }
      for (const h of far.hills) {
        const p = topOnScreen(h.x, h.h, h.z, a)!;
        if (Math.abs(p.x - m.x) * a < r + 0.03) expect(p.y).toBeGreaterThan(m.y + r + 0.015);
      }
    }
  });
  it('stays below the header, the stats and the search box', () => {
    for (const { w, h, a } of windows) {
      for (const { kind, t } of farThings(far)) {
        const p = topOnScreen(t.x, FAR_HEIGHT[kind] * t.scale, t.z, a)!;
        for (const r of uiRects(w, h)) if (r.name !== 'pinned and chips' && p.x > r.x0 && p.x < r.x1) expect(p.y, `${kind} under ${r.name} @${w}`).toBeGreaterThan(r.y1);
      }
    }
  });
  it('builds the heights it declares and stays within its triangles', () => {
    const tall = (g: Parameters<typeof trianglesOf>[0]) => new Box3().setFromBufferAttribute(g.getAttribute('position') as never).max.y;
    expect(tall(shapes.deadTrees.geo)).toBeLessThanOrEqual(FAR_HEIGHT.deadTree + 0.1);
    expect(tall(shapes.autumnTrees.geo)).toBeLessThanOrEqual(FAR_HEIGHT.autumnTree + 0.1);
    expect(tall(shapes.scarecrows.geo)).toBeLessThanOrEqual(FAR_HEIGHT.scarecrow + 0.1);
    expect(tall(shapes.village.geo)).toBeLessThanOrEqual(FAR_HEIGHT.village + 0.1);
    const inst = (p: { geo: Parameters<typeof trianglesOf>[0]; at: unknown[] }) => trianglesOf(p.geo) * p.at.length;
    const tris =
      trianglesOf(shapes.statics) + trianglesOf(shapes.windows) + trianglesOf(mistBands(far, [1, 1, 1])) + inst(shapes.village) + trianglesOf(shapes.village.win) * shapes.village.at.length +
      inst(shapes.deadTrees) + inst(shapes.crows) + inst(shapes.autumnTrees) + inst(shapes.scarecrows) + inst(shapes.fence) + inst(shapes.hay);
    expect(tris).toBeLessThanOrEqual(FAR_PARTS.tris);
    expect(shapes.crows.at.length).toBe(far.deadTrees.reduce((n, t) => n + t.crows, 0));
  });
});

describe('the Pumpkin Patch dusk clouds', () => {
  it('sit high in the sky, above the horizon, the barn roof and the windmill, and away from the header text and search box', () => {
    for (const { w, h, a } of windows) {
      for (let t = 0; t < 600; t += 11) {
        for (const p of duskPuffsOnScreen(a, t)) {
          expect(p.y + p.ry).toBeLessThan(0.35);
          for (const r of uiRects(w, h)) {
            const hit = p.x + p.rx / a > r.x0 && p.x - p.rx / a < r.x1 && p.y + p.ry > r.y0 && p.y - p.ry < r.y1;
            expect(hit, `cloud ${p.cloud} behind ${r.name} @${w}`).toBe(false);
          }
        }
      }
    }
  });
  it('keep off the moon face; only a thin wisp may cross its edge', () => {
    for (const { a } of windows) for (let t = 0; t < 600; t += 3) expect(duskOnMoon(a, t)).toBe(false);
    for (const c of DUSK_CLOUDS.filter((c) => c.wisp)) expect(c.hh).toBeLessThan(0.006);
  });
  it('are long flat banks and streaks of mixed sizes, in three depth layers, no two the same', () => {
    for (const c of DUSK_CLOUDS) expect(c.hw / c.hh).toBeGreaterThan(3);
    expect(DUSK_CLOUDS.filter((c) => c.hw >= 0.068).length).toBeGreaterThanOrEqual(2);
    expect(DUSK_CLOUDS.filter((c) => c.hh <= 0.008).length).toBeGreaterThanOrEqual(3);
    expect(new Set(DUSK_CLOUDS.map((c) => c.layer)).size).toBe(3);
    expect(new Set(DUSK_PUFFS.map((p) => JSON.stringify(p))).size).toBe(DUSK_PUFFS.length);
    // Far layers are fainter and hazier.
    expect(DUSK_LAYERS[0].alpha).toBeLessThan(DUSK_LAYERS[2].alpha);
    expect(DUSK_LAYERS[0].haze).toBeGreaterThan(DUSK_LAYERS[2].haze);
    expect(DUSK_DISTANCE[0]).toBeGreaterThan(DUSK_DISTANCE[2]);
  });
  it('drift slowly, each layer at its own speed, and fit the triangles declared', () => {
    for (const l of DUSK_LAYERS) expect(l.sway * l.speed).toBeLessThan(0.0002);
    expect(new Set(DUSK_LAYERS.map((l) => l.speed)).size).toBe(3);
    expect(2 * duskPuffCount()).toBeLessThanOrEqual(FAR_PARTS.cloudTris);
    expect(buildPumpkinFar(1)).toEqual(far);
  });
});

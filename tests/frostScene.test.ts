// The richer Frozen Cemetery: the chapel at the end of the snowy path, the graveyard, the bones under the ice, the ice pillars, the wolves and
// the weather. The plan is pure numbers, so the rules (everything on the snow, the path clear, nothing outside the picture) are checked here.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { LAYOUT_SEED, footprintsOverlap } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { LAKE, LAKE_Y, lakeDistance, onLake } from '../lib/scene/uniqueScenes/frostIce';
import {
  CHAPEL, CHAPEL_FOOT, GUST_LENGTH_S, GUST_PERIOD_S, HOWL_PERIOD_S, MAX_STONES, PATH_HALF_WIDTH, PATH_POINTS, RIDGE, blink, buildFrostPlan, gustAt, howlAmount,
  pathCentre, worldOf,
} from '../lib/scene/uniqueScenes/frostPlan';
import { VIEW_ASPECTS, distToPath } from '../lib/scene/uniqueScenes/types';
const spec = themeScene('frost').unique!;
const plan = spec.frost!.plan;
const attached = spec.frost!.attached;
describe('the snowy path', () => {
  it('starts at the bottom of the screen, goes round the lake and ends at the chapel door', () => {
    const first = plan.path[0]!;
    expect(Math.abs(first.x - 0.5)).toBeLessThan(0.6);
    expect(first.z).toBeGreaterThan(6);
    const last = plan.path[plan.path.length - 1]!;
    const doorZ = CHAPEL.z + CHAPEL.frontZ * CHAPEL.scale;
    expect(Math.abs(last.x - CHAPEL.x)).toBeLessThan(1.2);
    expect(last.z - doorZ).toBeGreaterThan(0.2);
    expect(last.z - doorZ).toBeLessThan(2.5);
    expect(spec.path.centre).toBe(plan.path);
    expect(spec.path.halfWidth).toBe(PATH_HALF_WIDTH);
  });
  it('is one unbroken line with no jump, and never crosses the ice', () => {
    for (let i = 1; i < plan.path.length; i++) expect(Math.hypot(plan.path[i]!.x - plan.path[i - 1]!.x, plan.path[i]!.z - plan.path[i - 1]!.z)).toBeLessThan(1.6);
    for (const c of plan.path) expect(lakeDistance(c.x, c.z, PATH_HALF_WIDTH + 0.5), `${c.x},${c.z}`).toBeGreaterThan(1);
    expect(pathCentre()).toEqual(plan.path);
    expect(PATH_POINTS.length).toBeGreaterThan(5);
  });
  it('has footprints that lead along it toward the chapel, one every step, alternating sides', () => {
    expect(plan.prints.length).toBeGreaterThan(30);
    for (const p of plan.prints) {
      expect(p.z).toBeLessThan(5.6);
      expect(distToPath(plan.path, p.x, p.z)).toBeLessThan(PATH_HALF_WIDTH);
    }
    // They run away from the camera: each is further back than the one 4 before it.
    for (let i = 4; i < plan.prints.length - 4; i += 4) expect(plan.prints[i + 4]!.z).toBeLessThan(plan.prints[i]!.z + 3);
  });
  it('keeps the middle of the view toward the chapel clear: nothing but the path and the lake lies on the line from the camera to the door', () => {
    for (const s of plan.stones) expect(distToPath(plan.path, s.x, s.z)).toBeGreaterThanOrEqual(PATH_HALF_WIDTH + 0.5);
    for (const g of plan.openGraves) expect(distToPath(plan.path, g.x, g.z)).toBeGreaterThan(PATH_HALF_WIDTH + 1);
  });
});
describe('the chapel', () => {
  it('stands in the middle of the view, behind the lake, with its feet in the snow', () => {
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      const foot = project([CHAPEL.x, 0, CHAPEL.z], cam)!;
      expect(foot.x).toBeGreaterThan(0.4);
      expect(foot.x).toBeLessThan(0.6);
      // About nine units tall with its cross: the top stays below the search and the pinned pages (y 0.3 and up from the top is theirs).
      const top = project([CHAPEL.x, 9.3 * CHAPEL.scale, CHAPEL.z], cam)!;
      expect(top.y).toBeGreaterThan(0.18);
      expect(top.y).toBeLessThan(foot.y - 0.08);
    }
    expect(CHAPEL.z).toBeLessThan(LAKE.z - LAKE.rz - 3);
    expect(footprintsOverlap(CHAPEL_FOOT, { x: LAKE.x, z: LAKE.z, hx: LAKE.rx, hz: LAKE.rz, rotY: 0 })).toBe(false);
  });
  it('has icicles under its eaves, all hanging from the chapel and none in the ground', () => {
    expect(plan.chapelIcicles.length).toBeGreaterThanOrEqual(15);
    for (const ic of plan.chapelIcicles) {
      expect(Math.abs(ic.x - CHAPEL.x)).toBeLessThan(6.5);
      expect(Math.abs(ic.z - CHAPEL.z)).toBeLessThan(6);
      expect(ic.y - ic.length).toBeGreaterThan(0.5);
      expect(ic.length).toBeGreaterThan(0.3);
    }
  });
});
describe('the frozen lake and what is under it', () => {
  it('is thick ice, with every hand and the skull under its top and inside its shore, and one hand through it', () => {
    expect(LAKE_Y).toBeGreaterThan(1);
    expect(plan.hands.length).toBeGreaterThanOrEqual(2);
    expect(plan.hands.length).toBeLessThanOrEqual(3);
    for (const s of [...plan.hands, plan.skull, plan.broken]) {
      expect(lakeDistance(s.x, s.z, -1), `${s.x},${s.z}`).toBeLessThan(0.95);
      expect(onLake(s.x, s.z)).toBe(true);
    }
  });
  it('keeps the bones in the near half of the lake, clear of the gravestones in the ice, so they can be seen', () => {
    for (const s of [...plan.hands, plan.skull, plan.broken]) {
      expect(s.z).toBeGreaterThan(LAKE.z - LAKE.rz * 0.5);
      for (const id of spec.ice!.stones) {
        const stone = spec.placements.find((p) => p.id === id)!;
        expect(Math.hypot(stone.x - s.x, stone.z - s.z), id).toBeGreaterThan(2.2);
      }
    }
  });
});
describe('the graveyard', () => {
  it('has many tilted tombstones, spread on both sides of the path, in the picture and off the ice and the chapel', () => {
    expect(plan.stones.length).toBeGreaterThanOrEqual(22);
    expect(plan.stones.length).toBeLessThanOrEqual(MAX_STONES);
    const sideOf = (x: number, z: number) => {
      const nearest = plan.path.reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best));
      return x < nearest.x ? -1 : 1;
    };
    const left = plan.stones.filter((s) => sideOf(s.x, s.z) < 0).length;
    expect(left).toBeGreaterThanOrEqual(6);
    expect(plan.stones.length - left).toBeGreaterThanOrEqual(6);
    for (const s of plan.stones) {
      expect(onLake(s.x, s.z, 1.5), 'on the ice').toBe(false);
      expect(Math.abs(s.x - 0.5)).toBeLessThanOrEqual(0.5 * (16 - s.z));
      expect(s.z).toBeLessThanOrEqual(1.5);
      expect(footprintsOverlap({ x: s.x, z: s.z, hx: 0.5, hz: 0.4, rotY: 0 }, CHAPEL_FOOT)).toBe(false);
      expect(s.sink).toBeLessThan(0.3);
    }
    // Tilted: they do not all stand straight.
    expect(plan.stones.filter((s) => Math.max(Math.abs(s.tilt[0]), Math.abs(s.tilt[1])) > 0.1).length).toBeGreaterThan(plan.stones.length / 3);
    expect(plan.stones.some((s) => s.kind === 'cross')).toBe(true);
    for (let i = 0; i < plan.stones.length; i++) {
      for (let j = i + 1; j < plan.stones.length; j++) expect(Math.hypot(plan.stones[i]!.x - plan.stones[j]!.x, plan.stones[i]!.z - plan.stones[j]!.z)).toBeGreaterThan(1.8);
    }
  });
  it('has open graves, four iron lanterns that are the warm lights, and candles that glow', () => {
    expect(plan.openGraves.length).toBeGreaterThanOrEqual(2);
    expect(plan.lanterns).toHaveLength(4);
    expect(spec.lights).toHaveLength(4);
    for (const l of spec.lights) {
      expect(l.kind).toBe('lantern');
      expect(plan.lanterns.some((p) => p.x === l.x && p.z === l.z)).toBe(true);
    }
    expect(spec.lights.length).toBeLessThanOrEqual(6);
    expect(spec.glows.filter((g) => g.kind === 'candle')).toHaveLength(plan.candles.length);
    expect(plan.candles.length).toBeGreaterThanOrEqual(3);
    // Every lantern stands beside the path, not on it.
    for (const l of plan.lanterns) expect(distToPath(plan.path, l.x, l.z)).toBeGreaterThan(PATH_HALF_WIDTH + 0.5);
  });
  it('has two ice pillars among the graves, off the path and off the middle of the view', () => {
    expect(plan.pillars).toHaveLength(2);
    for (const p of plan.pillars) {
      expect(distToPath(plan.path, p.x, p.z)).toBeGreaterThan(PATH_HALF_WIDTH + 2);
      expect(Math.abs(p.x - 0.5)).toBeGreaterThan(8);
      expect(Math.abs(p.x - 0.5)).toBeLessThanOrEqual(0.5 * (16 - p.z));
    }
  });
  it('has a broken fence, half buried: some bars short, some missing, all leaning, all sunk', () => {
    expect(plan.bars.length).toBeGreaterThanOrEqual(10);
    expect(plan.rails.length).toBeGreaterThanOrEqual(2);
    expect(plan.bars.filter((b) => b.height < 1.1).length).toBeGreaterThan(0);
    for (const b of plan.bars) {
      expect(b.sink).toBeGreaterThan(0.1);
      expect(b.sink).toBeLessThan(0.8);
      expect(b.height).toBeLessThanOrEqual(1.7);
    }
  });
  it('puts the snowy owl on top of a tombstone', () => {
    const near = plan.stones.filter((s) => Math.hypot(s.x - plan.owl.x, s.z - plan.owl.z) < 0.01);
    expect(near).toHaveLength(1);
    expect(near[0]!.kind).toBe('slab');
    expect(plan.owl.y).toBeGreaterThan(1.2);
  });
});
describe('the dead trees and the pines', () => {
  const trees = spec.placements.filter((p) => p.model === 'tree_dead_large');
  it('hang an empty lantern from a branch and sit crows on others, all at the real branch tips of the tree', () => {
    expect(attached.hanging.length).toBeGreaterThanOrEqual(1);
    expect(attached.crows.length).toBeGreaterThanOrEqual(2);
    for (const h of [...attached.hanging, ...attached.crows]) {
      const near = trees.some((t) => Math.hypot(t.x - h.x, t.z - h.z) < 2.6 * t.scale + 0.01 && h.y > 3 * t.scale);
      expect(near, `${h.x},${h.y},${h.z}`).toBe(true);
    }
    expect(attached.treeIcicles.length).toBe(trees.length * 6);
  });
  it('turn a point of the model into the world the way the drawing does', () => {
    const t = { ...trees[0]!, rotY: 0, x: 3, z: -4, y: 0.5, scale: 2 };
    expect(worldOf(t, [1, 2, 3])).toEqual([5, 4.5, 2]);
    const turned = worldOf({ ...t, rotY: Math.PI / 2 }, [1, 0, 0]);
    expect(turned[0]).toBeCloseTo(3, 9);
    expect(turned[2]).toBeCloseTo(-6, 9);
  });
  it('put pairs of glowing eyes low between pines, in the picture', () => {
    expect(attached.eyes.length).toBeGreaterThanOrEqual(1);
    for (const e of attached.eyes) {
      expect(e.y).toBeGreaterThan(0.4);
      expect(e.y).toBeLessThan(1.1);
      expect(Math.abs(e.x - 0.5)).toBeLessThanOrEqual(0.5 * (16 - e.z));
    }
    expect(new Set(attached.eyes.map((e) => e.phase.toFixed(3))).size).toBe(attached.eyes.length);
  });
  it('cap every ice boulder with snow, and the boulders are small', () => {
    const rocks = spec.placements.filter((p) => p.model === 'frost_rock');
    expect(attached.rockCaps).toHaveLength(rocks.length);
    for (const r of rocks) expect(r.scale).toBeLessThanOrEqual(1.3);
    for (const c of attached.rockCaps) expect(c.y).toBeGreaterThan(0.5);
  });
});
describe('the wolves', () => {
  it('are three silhouettes on the far ridge, facing the moon, and exactly one howls', () => {
    expect(plan.wolves).toHaveLength(3);
    expect(plan.wolves.filter((w) => w.howl)).toHaveLength(1);
    for (const w of plan.wolves) {
      expect(Math.abs(w.x - RIDGE.x)).toBeLessThan(RIDGE.rx);
      expect(w.y).toBeGreaterThan(0.5);
      expect(w.y).toBeLessThanOrEqual(RIDGE.ry);
      // They face the right of the screen, where the moon is.
      expect(Math.cos(w.rotY)).toBeGreaterThan(0.8);
    }
  });
  it('raise the howling head slowly, hold it, and lower it again, every 20 seconds', () => {
    expect(howlAmount(0)).toBe(0);
    expect(howlAmount(1.5)).toBeGreaterThan(0.3);
    expect(howlAmount(1.5)).toBeLessThan(0.7);
    expect(howlAmount(5)).toBe(1);
    expect(howlAmount(10.5)).toBeGreaterThan(0.3);
    expect(howlAmount(15)).toBe(0);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (t) => {
        const a = howlAmount(t);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
        expect(howlAmount(t + HOWL_PERIOD_S)).toBeCloseTo(a, 6);
      }),
    );
  });
  it('are spaced apart on the ridge', () => {
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(plan.wolves[i]!.x - plan.wolves[j]!.x, plan.wolves[i]!.z - plan.wolves[j]!.z)).toBeGreaterThan(1.5);
  });
});
describe('eyes, gusts and the weather', () => {
  it('blink for a moment now and then and are open the rest of the time', () => {
    expect(blink(5, 0)).toBe(1);
    expect(blink(0.1, 0)).toBeLessThan(0.2);
    fc.assert(fc.property(fc.double({ min: 0, max: 500, noNaN: true }), fc.double({ min: 0, max: 12, noNaN: true }), (t, phase) => {
      const b = blink(t, phase);
      expect(b).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(b).toBeLessThanOrEqual(1);
    }));
  });
  it('gusts come now and then, swell and fade smoothly, and are calm in between', () => {
    expect(gustAt(0)).toBe(0);
    expect(gustAt(GUST_LENGTH_S / 2)).toBeCloseTo(1, 9);
    expect(gustAt(GUST_LENGTH_S + 0.1)).toBe(0);
    expect(gustAt(GUST_PERIOD_S - 1)).toBe(0);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), (t) => {
        const g = gustAt(t);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(gustAt(t + GUST_PERIOD_S)).toBeCloseTo(g, 6);
        // Smooth: it never jumps.
        expect(Math.abs(gustAt(t + 0.01) - g)).toBeLessThan(0.05);
      }),
    );
    // More calm than gust.
    expect(GUST_LENGTH_S).toBeLessThan(GUST_PERIOD_S / 2);
  });
  it('keeps falling snow, the mist layer and the ghosts, with a deeper navy, less hazy scene', () => {
    expect(spec.weather!.kind).toBe('snow');
    expect(spec.layers.mist).toBe(true);
    expect(spec.layers.ghosts).toBe(true);
    // Less fog than before (it was 1): the scene keeps its contrast.
    expect(spec.fogScale).toBeLessThan(0.7);
    expect(spec.fogScale).toBeGreaterThan(0.3);
    expect(spec.moon.crisp).toBe(true);
  });
});
describe('the plan', () => {
  it('is the same for the same seed and keeps every claim off the others', () => {
    fc.assert(
      fc.property(fc.constantFrom(LAYOUT_SEED, 7, 99, 2024), (seed) => {
        const a = buildFrostPlan(seed);
        expect(a).toEqual(buildFrostPlan(seed));
        expect(a.stones.length).toBeLessThanOrEqual(MAX_STONES);
        for (const s of a.stones) expect(lakeDistance(s.x, s.z), 'on the ice').toBeGreaterThan(1);
      }),
      { numRuns: 4 },
    );
  });
  it('leaves the other themes alone: only the Frozen Cemetery has a frost plan', () => {
    for (const id of ['pumpkin', 'forest', 'bloodmoon', 'castle'] as const) expect(themeScene(id).unique?.frost).toBeUndefined();
  });
});

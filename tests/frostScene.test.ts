// The Frozen Cemetery as a simple, clear picture: the path to the haunted house, the pond, the few tombstones, the corners, the creatures and the far
// backdrop. The plan is pure numbers, so the rules (everything on the snow, the path clear, nothing outside the picture, nothing behind the
// chips or the search box) are checked here.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { LAYOUT_SEED, footprintsOverlap } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { LAKE, onLake } from '../lib/scene/uniqueScenes/frostIce';
import {
  FROST_MOON_SCALE, GATE, HOUSE, HOUSE_FOOT, HOWL_PERIOD_S, MAX_STONES, PATH_HALF_WIDTH, PATH_POINTS, PINE_SPOT, POND_HOLE, RIDGE, TREE_SPOT, buildBackdrop,
  buildFrostPlan, frostMoonTarget, STEEPLE, gustAt, housePoint, howlAmount, overMoon, pathCentre, windTravel, worldOf,
} from '../lib/scene/uniqueScenes/frostPlan';
import { VIEW_ASPECTS, distToPath } from '../lib/scene/uniqueScenes/types';
import { moonScreenRadiusScaled } from '../lib/scene/sky';
const spec = themeScene('frost').unique!;
const plan = spec.frost!.plan;
const attached = spec.frost!.attached;
/** Where the chips, the search box and the stats panel are, as fractions of the window: nothing of the scene may be *planned* to stand there. */
const BEHIND_UI_Y = 0.3;
describe('the snowy path', () => {
  it('starts at the bottom centre of the screen and ends in front of the house door, through the broken gate', () => {
    const first = plan.path[0]!;
    expect(Math.abs(first.x - 0.5)).toBeLessThan(0.6);
    expect(first.z).toBeGreaterThan(6);
    const last = plan.path[plan.path.length - 1]!;
    const [doorX, , doorZ] = housePoint(0, 0, HOUSE.frontZ);
    expect(Math.hypot(last.x - doorX, last.z - doorZ)).toBeLessThan(2.2);
    expect(Math.hypot(last.x - doorX, last.z - doorZ)).toBeGreaterThan(0.5);
    const [gateX, , gateZ] = housePoint(0, 0, GATE.lz);
    expect(distToPath(plan.path, gateX, gateZ)).toBeLessThan(GATE.half * HOUSE.scale);
    expect(spec.path.centre).toBe(plan.path);
    expect(spec.path.halfWidth).toBe(PATH_HALF_WIDTH);
  });
  it('is one unbroken line, never crosses the pond, and climbs steadily toward the house', () => {
    for (let i = 1; i < plan.path.length; i++) {
      expect(Math.hypot(plan.path[i]!.x - plan.path[i - 1]!.x, plan.path[i]!.z - plan.path[i - 1]!.z)).toBeLessThan(1.6);
      expect(plan.path[i]!.z).toBeLessThan(plan.path[i - 1]!.z + 0.01);
    }
    for (const c of plan.path) expect(onLake(c.x, c.z, PATH_HALF_WIDTH + 1)).toBe(false);
    expect(pathCentre()).toEqual(plan.path);
    expect(PATH_POINTS.length).toBeGreaterThan(5);
  });
  it('has footprints along it, one every step, alternating sides, none in the foreground behind the cards', () => {
    expect(plan.prints.length).toBeGreaterThan(15);
    for (const p of plan.prints) {
      expect(p.z).toBeLessThan(-1.9);
      expect(distToPath(plan.path, p.x, p.z)).toBeLessThan(PATH_HALF_WIDTH);
    }
  });
  it('keeps the middle of the view empty: no tombstone near the camera behind the cards, none on the path', () => {
    for (const s of plan.stones.slice(1)) {
      expect(distToPath(plan.path, s.x, s.z)).toBeGreaterThanOrEqual(PATH_HALF_WIDTH + 0.5);
      if (Math.abs(s.x - 0.5) < 9) expect(s.z).toBeLessThanOrEqual(-8.5);
    }
  });
});
describe('the moon', () => {
  it('floats whole in the sky at the upper right, and no far pine, house part, smoke or ghost stands over it', () => {
    for (const a of VIEW_ASPECTS) {
      const t = frostMoonTarget(a);
      const r = moonScreenRadiusScaled(a, FROST_MOON_SCALE).disc;
      expect(t.x + r / a).toBeLessThan(0.985);
      expect(t.y - r).toBeGreaterThan(0.15);
    }
    for (const p of buildBackdrop(1).pines) expect(overMoon([p.x, p.y + p.scale, p.z])).toBe(false);
    // The house: its corners, the chimney top and the top of the smoke.
    for (const lx of [-HOUSE.halfW - 0.6, 0, HOUSE.halfW + 0.6]) expect(overMoon(housePoint(lx, 6.3, 0), 0.01)).toBe(false);
    expect(overMoon(housePoint(HOUSE.chimneyX + 3, HOUSE.chimneyTop + 1.5 / HOUSE.scale, HOUSE.chimneyZ), 0.01)).toBe(false);
    for (const g of spec.ghostSpots) for (const dx of [-0.9, 0, 0.9]) expect(overMoon([g.x + dx, g.y + 1.4, g.z], 0.01)).toBe(false);
    for (const c of plan.cottages) expect(overMoon([c.x, 3.4 * c.scale, c.z], 0.01)).toBe(false);
  });
});
describe('the midground: the haunted house and the pond', () => {
  it('puts the house in the centre back, in the gap between the chips and the horizon, below the search box and off the pond', () => {
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      const foot = project([HOUSE.x, 0, HOUSE.z], cam)!;
      expect(foot.x).toBeGreaterThan(0.45);
      expect(foot.x).toBeLessThan(0.75);
      const top = project(housePoint(HOUSE.chimneyX, HOUSE.chimneyTop, HOUSE.chimneyZ), cam)!;
      // The chimney is the tallest part: below the search box and the pinned pages' top.
      expect(top.y).toBeGreaterThan(BEHIND_UI_Y);
      expect(top.y).toBeLessThan(foot.y - 0.08);
    }
    expect(footprintsOverlap(HOUSE_FOOT, { x: LAKE.x, z: LAKE.z, hx: LAKE.rx, hz: LAKE.rz, rotY: 0 })).toBe(false);
  });
  it('has icicles under the house eaves, hanging from the house and above the snow', () => {
    expect(plan.houseIcicles.length).toBeGreaterThanOrEqual(10);
    for (const ic of plan.houseIcicles) {
      expect(Math.hypot(ic.x - HOUSE.x, ic.z - HOUSE.z)).toBeLessThan(4);
      expect(ic.y - ic.length).toBeGreaterThan(1.2);
    }
  });
  it('has a broken gate of two leaves at the path, a tattered flag on a leaning pole and five small cottages far back', () => {
    expect(plan.gate).toHaveLength(2);
    for (const g of plan.gate) expect(distToPath(plan.path, g.x, g.z)).toBeLessThan(PATH_HALF_WIDTH + 0.4);
    expect(plan.gate.some((g) => Math.abs(g.lean) > 0.15)).toBe(true);
    expect(Math.hypot(plan.flag.x - HOUSE.x, plan.flag.z - HOUSE.z)).toBeLessThan(5);
    expect(plan.flag.lean).toBeGreaterThan(0);
    expect(plan.cottages).toHaveLength(5);
    expect(plan.cottages.filter((c) => c.x < 0).length).toBeGreaterThanOrEqual(2);
    expect(plan.cottages.filter((c) => c.x > 0).length).toBeGreaterThanOrEqual(2);
    for (const c of plan.cottages) expect(c.z).toBeLessThan(-45);
  });
  it('puts a round pond to the left of the cards with exactly one hand reaching up through a hole in it', () => {
    for (const aspect of VIEW_ASPECTS) {
      const p = project([LAKE.x, 0, LAKE.z], cameraAt(0, aspect, true))!;
      expect(p.x).toBeGreaterThan(0.1);
      expect(p.x).toBeLessThan(0.3);
      expect(p.y).toBeGreaterThan(0.45);
      expect(p.y).toBeLessThan(0.56);
    }
    expect(LAKE.rx / LAKE.rz).toBeLessThan(1.3);
    expect(onLake(plan.hand.x, plan.hand.z, -1)).toBe(true);
    expect(plan.hand.x).toBe(POND_HOLE.x);
    expect(plan.hand.z).toBe(POND_HOLE.z);
  });
});
describe('the graveyard', () => {
  it('has a few tombstones on both sides of the path, in the picture, off the pond and the house, widely spaced', () => {
    expect(plan.stones.length).toBeGreaterThanOrEqual(6);
    expect(plan.stones.length).toBeLessThanOrEqual(MAX_STONES);
    const sideOf = (x: number, z: number) => {
      const nearest = plan.path.reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best));
      return x < nearest.x ? -1 : 1;
    };
    const rows = plan.stones.slice(1);
    expect(rows.filter((s) => sideOf(s.x, s.z) < 0).length).toBeGreaterThanOrEqual(2);
    expect(rows.filter((s) => sideOf(s.x, s.z) > 0).length).toBeGreaterThanOrEqual(2);
    for (const s of plan.stones) {
      expect(onLake(s.x, s.z, 1.5)).toBe(false);
      expect(Math.abs(s.x - 0.5)).toBeLessThanOrEqual(0.5 * (16 - s.z));
      expect(footprintsOverlap({ x: s.x, z: s.z, hx: 0.5, hz: 0.4, rotY: 0 }, HOUSE_FOOT)).toBe(false);
      expect(s.sink).toBeLessThan(0.25);
      expect(Math.abs(s.tilt[0])).toBeLessThan(0.1);
      expect(Math.abs(s.tilt[1])).toBeLessThan(0.2);
    }
    expect(plan.stones.some((s) => s.kind === 'cross')).toBe(true);
    // Widely spaced, so the snow breathes.
    for (let i = 0; i < plan.stones.length; i++) {
      for (let j = i + 1; j < plan.stones.length; j++) expect(Math.hypot(plan.stones[i]!.x - plan.stones[j]!.x, plan.stones[i]!.z - plan.stones[j]!.z)).toBeGreaterThan(2.6);
    }
  });
  it('hangs small icicles on the slabs, two on each, from the top edge, hanging in the air above the snow', () => {
    const slabs = plan.stones.slice(1).filter((s) => s.kind === 'slab');
    expect(plan.stoneIcicles).toHaveLength(slabs.length * 2);
    for (const ic of plan.stoneIcicles) {
      expect(ic.length).toBeLessThan(0.5);
      expect(ic.y - ic.length).toBeGreaterThan(0.6);
    }
  });
  it('has four hanging lanterns on hook posts along the path (the arms reaching toward it) and an old one by the open grave', () => {
    expect(plan.lanterns).toHaveLength(5);
    const grave = plan.props.find((p) => p.kind === 'grave')!;
    expect(Math.hypot(plan.lanterns[4]!.x - grave.x, plan.lanterns[4]!.z - grave.z)).toBeLessThan(3);
    for (const l of plan.lanterns.slice(0, 4)) {
      expect(distToPath(plan.path, l.x, l.z)).toBeGreaterThan(PATH_HALF_WIDTH + 0.5);
      // The end of the arm is nearer the path than the post.
      const tip = { x: l.x + Math.cos(l.rotY) * 0.6, z: l.z - Math.sin(l.rotY) * 0.6 };
      expect(distToPath(plan.path, tip.x, tip.z)).toBeLessThan(distToPath(plan.path, l.x, l.z));
    }
    for (let i = 0; i < plan.lanterns.length; i++) {
      for (let j = i + 1; j < plan.lanterns.length; j++) expect(Math.hypot(plan.lanterns[i]!.x - plan.lanterns[j]!.x, plan.lanterns[i]!.z - plan.lanterns[j]!.z)).toBeGreaterThan(3);
    }
  });
  it('has broken fences, half buried: some bars short, some missing, all sunk, one run behind the graves and the house fence at its gate', () => {
    expect(plan.bars.length).toBeGreaterThanOrEqual(10);
    expect(plan.rails.length).toBeGreaterThanOrEqual(6);
    expect(plan.bars.filter((b) => b.height < 1.2).length).toBeGreaterThan(0);
    for (const b of plan.bars) {
      expect(b.sink).toBeGreaterThan(0.2);
      expect(b.z).toBeLessThan(-18);
      expect(distToPath(plan.path, b.x, b.z)).toBeGreaterThan(0.6);
    }
  });
});
describe('the foreground corners', () => {
  it('has the big pine and a tombstone on the left, and the short bare tree with two crows on the right; crows on other trees and tombstones', () => {
    const pine = spec.placements.find((p) => p.model === 'frost_pine_a' && p.group === 'themed')!;
    expect(pine.x).toBe(PINE_SPOT.x);
    expect(pine.x).toBeLessThan(0);
    const tree = spec.placements.find((p) => p.model === 'tree_dead_large')!;
    expect(tree.x).toBeGreaterThan(3);
    expect(tree.x).toBeLessThan(TREE_SPOT.x + 2);
    expect(attached.crows.length).toBeGreaterThanOrEqual(5);
    for (const c of attached.crows.slice(0, 2)) {
      expect(Math.hypot(c.x - tree.x, c.z - tree.z)).toBeLessThan(2.6 * tree.scale);
      expect(c.y).toBeGreaterThan(2.5 * tree.scale);
    }
    expect(plan.stones[0]!.kind).toBe('slab');
    expect(plan.stones[0]!.x).toBeLessThan(0);
  });
  it('turns a point of a model into the world the way the drawing does', () => {
    const t = { ...spec.placements.find((p) => p.model === 'tree_dead_large')!, rotY: 0, x: 3, z: -4, y: 0.5, scale: 2 };
    expect(worldOf(t, [1, 2, 3])).toEqual([5, 4.5, 2]);
    const turned = worldOf({ ...t, rotY: Math.PI / 2 }, [1, 0, 0]);
    expect(turned[0]).toBeCloseTo(3, 9);
    expect(turned[2]).toBeCloseTo(-6, 9);
  });
  it('leaves the centre behind the cards empty: no placement and no drift near the camera in the middle', () => {
    for (const p of spec.placements) if (Math.abs(p.x - 0.5) < 5) expect(p.z).toBeLessThan(-30);
    for (const d of spec.frost!.drifts) if (Math.abs(d.x - 0.5) < 3) expect(d.z).toBeLessThan(-9);
  });
});
describe('the filled snow', () => {
  const pines = spec.frost!.pines;
  const bareTrees = spec.placements.filter((p) => p.model === 'tree_dead_large');
  const side = (x: number) => (x < 0.5 ? 'left' : 'right');
  it('has clusters of snowy pines of different heights and bare trees with icicles on both sides, none in the middle behind the cards', () => {
    expect(pines.length).toBeGreaterThanOrEqual(14);
    for (const s of ['left', 'right']) {
      expect(pines.filter((p) => side(p.x) === s).length, s).toBeGreaterThanOrEqual(5);
      expect(bareTrees.filter((p) => side(p.x) === s).length, s).toBeGreaterThanOrEqual(1);
    }
    expect(Math.max(...pines.map((p) => p.height)) / Math.min(...pines.map((p) => p.height))).toBeGreaterThan(2);
    expect(bareTrees.length).toBeGreaterThanOrEqual(4);
    expect(attached.treeIcicles.length).toBe(bareTrees.length * 6);
    for (const p of pines) {
      if (Math.abs(p.x - 0.5) < 9) expect(p.z).toBeLessThan(-8.5);
      expect(distToPath(plan.path, p.x, p.z)).toBeGreaterThan(PATH_HALF_WIDTH);
    }
  });
  it('has the scary things: an angel, an open grave, a coffin, bones, a well, a cart, stumps, logs and a leaning gate, on both sides and off the path', () => {
    const kinds = new Set(plan.props.map((p) => p.kind));
    for (const k of ['angel', 'grave', 'coffin', 'bones', 'well', 'cart', 'stump', 'log', 'ironGate'] as const) expect(kinds.has(k), k).toBe(true);
    for (const s of ['left', 'right']) expect(plan.props.filter((p) => side(p.x) === s).length, s).toBeGreaterThanOrEqual(7);
    for (const p of plan.props) {
      expect(distToPath(plan.path, p.x, p.z)).toBeGreaterThan(PATH_HALF_WIDTH + 0.5);
      expect(onLake(p.x, p.z, 0.4)).toBe(false);
      if (Math.abs(p.x - 0.5) < 9) expect(p.z).toBeLessThan(-8.5);
    }
  });
  it('keeps the far steeple and cottages low on the horizon, off the moon and off the search box', () => {
    for (const a of VIEW_ASPECTS) {
      const cam = cameraAt(0, a, true);
      const top = project([STEEPLE.x, 9.4, STEEPLE.z], cam)!;
      expect(top.x).toBeLessThan(0.26);
      expect(top.y).toBeGreaterThan(0.2);
    }
    expect(overMoon([STEEPLE.x, 9.4, STEEPLE.z], 0.01)).toBe(false);
  });
});
describe('the wind', () => {
  it('blows between calm and a full gust, and the distance it carries things is its integral', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), (t) => {
        const g = gustAt(t);
        expect(g).toBeGreaterThanOrEqual(0.35 - 1e-9);
        expect(g).toBeLessThanOrEqual(1 + 1e-9);
        const h = 1e-3;
        expect((windTravel(t + h) - windTravel(t - h)) / (2 * h)).toBeCloseTo(g, 3);
      }),
    );
    expect(windTravel(0)).toBeCloseTo(0, 9);
  });
});
describe('the creatures', () => {
  it('has three wolves on a far ridge on the left, facing the moon, and exactly one howls', () => {
    expect(plan.wolves).toHaveLength(3);
    expect(plan.wolves.filter((w) => w.howl)).toHaveLength(1);
    for (const w of plan.wolves) {
      expect(w.x).toBeLessThan(0);
      expect(Math.abs(w.x - RIDGE.x)).toBeLessThan(RIDGE.rx);
      expect(w.y).toBeGreaterThan(0.5);
      expect(w.y).toBeLessThanOrEqual(RIDGE.ry);
      expect(Math.cos(w.rotY)).toBeGreaterThan(0.8);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(plan.wolves[i]!.x - plan.wolves[j]!.x, plan.wolves[i]!.z - plan.wolves[j]!.z)).toBeGreaterThan(1.5);
  });
  it('raises the howling head slowly, holds it, and lowers it again, every 20 seconds', () => {
    expect(howlAmount(0)).toBe(0);
    expect(howlAmount(1.5)).toBeGreaterThan(0.3);
    expect(howlAmount(5)).toBe(1);
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
  it('keeps the ghosts in the open, below the chips and above the cards, not behind the header', () => {
    for (const aspect of VIEW_ASPECTS) {
      for (const g of spec.ghostSpots) {
        const top = project([g.x, g.y - 0.6 + 2.2, g.z], cameraAt(0, aspect, true))!;
        expect(top.y).toBeGreaterThan(0.36);
      }
    }
  });
});
describe('the background', () => {
  it('is a chain of low snowy hills across the whole width with a dark line of pines on their crests, below the chips and the search box', () => {
    const { hills, pines } = buildBackdrop(1);
    expect(hills.length).toBeGreaterThan(8);
    expect(pines.length).toBeGreaterThan(80);
    expect(Math.min(...hills.map((h) => h.x))).toBeLessThan(-60);
    expect(Math.max(...hills.map((h) => h.x))).toBeGreaterThan(60);
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      for (const p of pines) {
        const top = project([p.x, p.y + p.scale, p.z], cam);
        if (top) expect(top.y, `${p.x},${p.z}`).toBeGreaterThan(0.31);
      }
    }
    for (const p of pines) expect(p.scale).toBeLessThan(3.6);
    expect(buildBackdrop(1)).toEqual(buildBackdrop(1));
  });
});
describe('the plan', () => {
  it('is the same for the same seed and keeps every claim off the others', () => {
    fc.assert(
      fc.property(fc.constantFrom(LAYOUT_SEED, 7, 99, 2024), (seed) => {
        const a = buildFrostPlan(seed);
        expect(a).toEqual(buildFrostPlan(seed));
        expect(a.stones.length).toBeLessThanOrEqual(MAX_STONES);
        for (const s of a.stones) expect(onLake(s.x, s.z, 1), 'on the pond').toBe(false);
      }),
      { numRuns: 4 },
    );
  });
});

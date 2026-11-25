// The Frozen Cemetery as a simple, clear picture: the path to the chapel, the pond, the graveyard rows, the corners, the creatures and the far
// backdrop. The plan is pure numbers, so the rules (everything on the snow, the path clear, nothing outside the picture, nothing behind the
// chips or the search box) are checked here.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cameraAt, project } from '../lib/scene/camera';
import { LAYOUT_SEED, footprintsOverlap } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { LAKE, onLake } from '../lib/scene/uniqueScenes/frostIce';
import {
  CHAPEL, CHAPEL_FOOT, HOWL_PERIOD_S, MAX_STONES, PATH_HALF_WIDTH, PATH_POINTS, PINE_SPOT, POND_HOLE, RIDGE, TREE_SPOT, buildBackdrop, buildFrostPlan,
  chapelPoint, howlAmount, pathCentre, worldOf,
} from '../lib/scene/uniqueScenes/frostPlan';
import { VIEW_ASPECTS, distToPath } from '../lib/scene/uniqueScenes/types';
const spec = themeScene('frost').unique!;
const plan = spec.frost!.plan;
const attached = spec.frost!.attached;
/** Where the chips, the search box and the stats panel are, as fractions of the window: nothing of the scene may be *planned* to stand there. */
const BEHIND_UI_Y = 0.3;
describe('the snowy path', () => {
  it('starts at the bottom centre of the screen and ends in front of the chapel door', () => {
    const first = plan.path[0]!;
    expect(Math.abs(first.x - 0.5)).toBeLessThan(0.6);
    expect(first.z).toBeGreaterThan(6);
    const last = plan.path[plan.path.length - 1]!;
    const [doorX, , doorZ] = chapelPoint(0, 0, CHAPEL.frontZ);
    expect(Math.hypot(last.x - doorX, last.z - doorZ)).toBeLessThan(2.2);
    expect(Math.hypot(last.x - doorX, last.z - doorZ)).toBeGreaterThan(0.5);
    expect(spec.path.centre).toBe(plan.path);
    expect(spec.path.halfWidth).toBe(PATH_HALF_WIDTH);
  });
  it('is one unbroken line, never crosses the pond, and climbs steadily toward the chapel', () => {
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
describe('the midground: the chapel on the right and the pond on the left', () => {
  it('puts the chapel to the right of the cards, in the gap between the chips and the horizon, clear of the search box', () => {
    for (const aspect of VIEW_ASPECTS) {
      const cam = cameraAt(0, aspect, true);
      const foot = project([CHAPEL.x, 0, CHAPEL.z], cam)!;
      expect(foot.x).toBeGreaterThan(0.62);
      expect(foot.x).toBeLessThan(0.8);
      const top = project(chapelPoint(CHAPEL.towerX + 0.3, 9.3, CHAPEL.towerZ), cam)!;
      // The spire is the tallest part: its top is below the pinned pages and the chips (y 0.3 and up is theirs).
      // (the chips stop at x 0.7: the tower is to the right of them, or below them)
      expect(top.x > 0.71 || top.y >= BEHIND_UI_Y - 0.015).toBe(true);
      expect(top.y).toBeGreaterThan(0.2);
      expect(top.y).toBeLessThan(foot.y - 0.08);
    }
    expect(footprintsOverlap(CHAPEL_FOOT, { x: LAKE.x, z: LAKE.z, hx: LAKE.rx, hz: LAKE.rz, rotY: 0 })).toBe(false);
    // The door looks a little toward the camera.
    expect(CHAPEL.rotY).toBeLessThan(0);
  });
  it('has icicles under the chapel eaves, hanging from the chapel and above the snow', () => {
    expect(plan.chapelIcicles.length).toBeGreaterThanOrEqual(15);
    for (const ic of plan.chapelIcicles) {
      expect(Math.hypot(ic.x - CHAPEL.x, ic.z - CHAPEL.z)).toBeLessThan(6);
      expect(ic.y - ic.length).toBeGreaterThan(0.4);
    }
  });
  it('puts a round pond to the left of the cards with exactly one hand reaching up through a hole in it', () => {
    for (const aspect of VIEW_ASPECTS) {
      const p = project([LAKE.x, 0, LAKE.z], cameraAt(0, aspect, true))!;
      expect(p.x).toBeGreaterThan(0.1);
      expect(p.x).toBeLessThan(0.3);
      expect(p.y).toBeGreaterThan(0.45);
      expect(p.y).toBeLessThan(0.56);
    }
    // Round on the ground.
    expect(LAKE.rx / LAKE.rz).toBeLessThan(1.3);
    expect(onLake(plan.hand.x, plan.hand.z, -1)).toBe(true);
    expect(plan.hand.x).toBe(POND_HOLE.x);
    expect(plan.hand.z).toBe(POND_HOLE.z);
  });
});
describe('the graveyard', () => {
  it('has neat rows of tombstones on both sides of the path, in the picture, off the pond and the chapel, well spaced', () => {
    expect(plan.stones.length).toBeGreaterThanOrEqual(16);
    expect(plan.stones.length).toBeLessThanOrEqual(MAX_STONES);
    const sideOf = (x: number, z: number) => {
      const nearest = plan.path.reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best));
      return x < nearest.x ? -1 : 1;
    };
    const rows = plan.stones.slice(1);
    expect(rows.filter((s) => sideOf(s.x, s.z) < 0).length).toBeGreaterThanOrEqual(4);
    expect(rows.filter((s) => sideOf(s.x, s.z) > 0).length).toBeGreaterThanOrEqual(4);
    for (const s of plan.stones) {
      expect(onLake(s.x, s.z, 1.5)).toBe(false);
      expect(Math.abs(s.x - 0.5)).toBeLessThanOrEqual(0.5 * (16 - s.z));
      expect(footprintsOverlap({ x: s.x, z: s.z, hx: 0.5, hz: 0.4, rotY: 0 }, CHAPEL_FOOT)).toBe(false);
      expect(s.sink).toBeLessThan(0.25);
      // Neat: only a slight lean.
      expect(Math.abs(s.tilt[0])).toBeLessThan(0.1);
      expect(Math.abs(s.tilt[1])).toBeLessThan(0.2);
    }
    expect(plan.stones.some((s) => s.kind === 'cross')).toBe(true);
    for (let i = 0; i < plan.stones.length; i++) {
      for (let j = i + 1; j < plan.stones.length; j++) expect(Math.hypot(plan.stones[i]!.x - plan.stones[j]!.x, plan.stones[i]!.z - plan.stones[j]!.z)).toBeGreaterThan(1.8);
    }
  });
  it('hangs small icicles on the rows of slabs, two on each, from the top edge, hanging in the air above the snow', () => {
    const slabs = plan.stones.slice(1).filter((s) => s.kind === 'slab');
    expect(plan.stoneIcicles).toHaveLength(slabs.length * 2);
    for (const ic of plan.stoneIcicles) {
      expect(ic.length).toBeLessThan(0.5);
      expect(ic.y - ic.length).toBeGreaterThan(0.6);
    }
  });
  it('has four or five small iron lanterns along the path, spaced apart, beside it and not on it', () => {
    expect(plan.lanterns.length).toBeGreaterThanOrEqual(4);
    expect(plan.lanterns.length).toBeLessThanOrEqual(5);
    for (const l of plan.lanterns) expect(distToPath(plan.path, l.x, l.z)).toBeGreaterThan(PATH_HALF_WIDTH + 0.5);
    for (let i = 0; i < plan.lanterns.length; i++) {
      for (let j = i + 1; j < plan.lanterns.length; j++) expect(Math.hypot(plan.lanterns[i]!.x - plan.lanterns[j]!.x, plan.lanterns[i]!.z - plan.lanterns[j]!.z)).toBeGreaterThan(3);
    }
  });
  it('has a broken fence behind the rows, half buried: some bars short, some missing, all sunk', () => {
    expect(plan.bars.length).toBeGreaterThanOrEqual(10);
    expect(plan.rails.length).toBeGreaterThanOrEqual(2);
    expect(plan.bars.filter((b) => b.height < 1.2).length).toBeGreaterThan(0);
    for (const b of plan.bars) {
      expect(b.sink).toBeGreaterThan(0.2);
      expect(b.z).toBeLessThan(-24);
    }
  });
});
describe('the foreground corners', () => {
  it('has the big pine and a tombstone with the owl on the left, and the short bare tree with two crows and an ice block on the right', () => {
    const pine = spec.placements.find((p) => p.model === 'frost_pine_a' && p.group === 'themed')!;
    expect(pine.x).toBe(PINE_SPOT.x);
    expect(pine.x).toBeLessThan(0);
    const tree = spec.placements.find((p) => p.model === 'tree_dead_large')!;
    expect(tree.x).toBeGreaterThan(3);
    expect(tree.x).toBeLessThan(TREE_SPOT.x + 2);
    expect(attached.crows).toHaveLength(2);
    for (const c of attached.crows) {
      expect(Math.hypot(c.x - tree.x, c.z - tree.z)).toBeLessThan(2.6 * tree.scale);
      expect(c.y).toBeGreaterThan(2.5 * tree.scale);
    }
    expect(plan.pillars).toHaveLength(1);
    expect(plan.pillars[0]!.x).toBeGreaterThan(3);
    // The owl sits on the first tombstone, in the left corner.
    expect(plan.stones[0]!.kind).toBe('slab');
    expect(plan.stones[0]!.x).toBeLessThan(0);
    expect(plan.owl.x).toBe(plan.stones[0]!.x);
    expect(plan.owl.y).toBeGreaterThan(1.8);
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

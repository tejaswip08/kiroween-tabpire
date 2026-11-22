import { describe, expect, it } from 'vitest';
import { BUDGET, CAPS } from '../lib/scene/config';
import { cameraAt, project } from '../lib/scene/camera';
import {
  PATH_TILE_OFFSET, PATH_TILE_SCALE, FLAT_GROUPS, GROUND, MODELS, PATH_EXEMPT, PATH_HALF_WIDTH, blocksMoon, buildLayout, footprintOf,
  footprintsOverlap, insideGround, layout, type Placement,
} from '../lib/scene/layout';

const L = buildLayout();
const solid = L.placements.filter((p) => !FLAT_GROUPS.includes(p.group));
const count = (g: Placement['group']) => L.placements.filter((p) => p.group === g).length;

describe('layout', () => {
  it('is the same for the same seed and different for another', () => {
    expect(buildLayout()).toEqual(L);
    expect(buildLayout(1031)).toEqual(L);
    expect(buildLayout(7).placements).not.toEqual(L.placements);
    expect(layout()).toBe(layout());
  });
  it('only uses models from the catalogue', () => {
    for (const p of L.placements) expect(MODELS[p.model]).toBeDefined();
  });
  it('has no two props overlapping at full capacity', () => {
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        expect(footprintsOverlap(footprintOf(solid[i]!), footprintOf(solid[j]!)), `${solid[i]!.id} ${solid[j]!.id}`).toBe(false);
      }
    }
  });
  it('keeps every prop inside the ground and standing on it', () => {
    for (const p of L.placements) {
      expect(insideGround(footprintOf(p)), p.id).toBe(true);
      expect(p.y).toBeLessThan(0.1);
      expect(Number.isFinite(p.x + p.z + p.rotY + p.scale)).toBe(true);
    }
  });
  it('makes the full capacity of every data-driven group', () => {
    expect(count('newGrave')).toBe(CAPS.newGraves);
    expect(count('coffin')).toBe(CAPS.coffins);
    expect(count('candle')).toBe(CAPS.candles);
    for (const g of ['newGrave', 'coffin', 'candle'] as const) {
      const slots = L.placements.filter((p) => p.group === g).map((p) => p.slot);
      expect(slots).toEqual([...slots.keys()]);
    }
  });
  it('always has the scenery', () => {
    for (const g of ['crypt', 'gate', 'fence', 'tree', 'oldGrave', 'pumpkin', 'lantern', 'path'] as const) {
      expect(count(g), g).toBeGreaterThan(0);
    }
    expect(L.placements.some((p) => p.model === 'post_lantern')).toBe(true);
  });
  it('puts the crypt right of centre, small and far back, with the gate in front of it', () => {
    const crypt = L.placements.find((p) => p.group === 'crypt')!;
    const gate = L.placements.find((p) => p.group === 'gate')!;
    expect(gate.z).toBeGreaterThan(crypt.z);
    for (const aspect of [16 / 10, 16 / 9, 21 / 9]) {
      const cam = cameraAt(0, aspect, true);
      const c = project([crypt.x, 3, crypt.z], cam)!;
      expect(c.x).toBeGreaterThan(0.5);
      expect(c.x).toBeLessThan(0.75);
      expect(c.depth).toBeGreaterThan(35);
      const g = project([gate.x, 2, gate.z], cam)!;
      expect(Math.abs(g.x - 0.5)).toBeLessThan(0.12);
    }
  });
  it('keeps the path narrower and clear of props, except the gate', () => {
    for (const p of solid) {
      if (PATH_EXEMPT.includes(p.group)) continue;
      const f = footprintOf(p);
      const r = Math.min(f.hx, f.hz);
      for (const c of L.pathCentres) expect(Math.hypot(c.x - p.x, c.z - p.z), p.id).toBeGreaterThan(PATH_HALF_WIDTH + r * 0.5);
    }
  });
  it('keeps tall props off the moon', () => {
    for (const p of L.placements) {
      if (p.group === 'crypt') continue;
      expect(blocksMoon(p), p.id).toBe(false);
    }
  });
  it('has at most the allowed real lights, with the crypt doorway first', () => {
    expect(L.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    expect(L.lights[0]!.kind).toBe('cryptDoor');
    expect(L.glows.filter((g) => g.kind === 'candle' && g.slot !== undefined)).toHaveLength(CAPS.candles);
  });
  it('has no floor tiles, and a winding path of cobblestones from the bottom centre to the gate', () => {
    expect(L.placements.some((p) => p.model === 'floor_dirt')).toBe(false);
    const path = L.placements.filter((p) => p.group === 'path');
    expect(path.length).toBeGreaterThan(20);
    const nearCamera = path.filter((p) => p.z > 6);
    expect(nearCamera.length).toBeGreaterThan(1);
    for (const p of nearCamera) expect(Math.abs(p.x)).toBeLessThan(3);
    const xs = L.pathCentres.map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.2);
    const gate = L.placements.find((p) => p.group === 'gate')!;
    expect(Math.hypot(L.pathCentres.at(-1)!.x - gate.x, L.pathCentres.at(-1)!.z - gate.z)).toBeLessThan(4);
  });
  it('has a path about 25 percent narrower than before', () => {
    const width = 2 * (PATH_TILE_OFFSET + MODELS.path_A.hx * PATH_TILE_SCALE);
    const before = 2 * (1.0 + MODELS.path_A.hx * 1.1);
    expect(width / before).toBeGreaterThan(0.72);
    expect(width / before).toBeLessThan(0.78);
  });
  it('fills both sides of the path with gravestones, crosses, skulls, bones and candles', () => {
    for (const side of [-1, 1]) {
      const here = L.placements.filter((p) => p.x * side > 3 && p.z < 10);
      expect(here.filter((p) => p.group === 'oldGrave').length).toBeGreaterThanOrEqual(10);
      expect(here.filter((p) => p.model.startsWith('gravemarker')).length).toBeGreaterThanOrEqual(3);
      expect(here.filter((p) => p.model.startsWith('skull')).length).toBeGreaterThanOrEqual(2);
      expect(here.filter((p) => p.model.startsWith('bone') || p.model === 'ribcage').length).toBeGreaterThanOrEqual(2);
      expect(here.filter((p) => p.model.startsWith('candle')).length).toBeGreaterThanOrEqual(6);
    }
    expect(L.glows.filter((g) => g.kind === 'candle' && g.slot === undefined).length).toBeGreaterThanOrEqual(10);
  });
  it('puts big jack-o-lanterns with glowing faces in the foreground', () => {
    const jacks = L.placements.filter((p) => p.model.includes('jackolantern'));
    expect(jacks.length).toBeGreaterThanOrEqual(4);
    // About 40 percent smaller than before (1.6 to 1.7), and moved inward so they are fully in view.
    const front = jacks.filter((p) => p.z > 4);
    expect(front.length).toBeGreaterThanOrEqual(2);
    for (const p of front) {
      expect(p.scale).toBeGreaterThanOrEqual(0.85);
      expect(p.scale).toBeLessThanOrEqual(1.1);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(5);
    }
    expect(L.lights.filter((l) => l.kind === 'jackOLantern').length).toBeGreaterThanOrEqual(2);
  });
  it('has autumn pines and bare dead trees on the edges, iron fences and hanging lanterns', () => {
    const trees = L.placements.filter((p) => p.group === 'tree');
    expect(trees.filter((p) => p.model.startsWith('tree_pine_orange')).length).toBeGreaterThanOrEqual(7);
    for (const side of [-1, 1]) {
      expect(trees.filter((p) => p.x * side > 10 && p.model.startsWith('tree_pine')).length).toBeGreaterThanOrEqual(2);
      expect(trees.filter((p) => p.x * side > 10 && (p.model.includes('dead') || p.model.startsWith('forest_twisted'))).length).toBeGreaterThanOrEqual(2);
    }
    expect(trees.filter((p) => p.model.includes('dead') || p.model.startsWith('forest_twisted')).length).toBeGreaterThanOrEqual(8);
    expect(trees.some((p) => p.model.startsWith('forest_twisted'))).toBe(true);
    expect(L.placements.filter((p) => p.model === 'post_lantern').length).toBeGreaterThanOrEqual(3);
    expect(L.placements.filter((p) => p.group === 'fence').length).toBeGreaterThanOrEqual(18);
    expect(L.ghostSpots.length).toBeGreaterThanOrEqual(2);
  });
  it('keeps the crypt, gate and fence on one line behind the path', () => {
    const gate = L.placements.find((p) => p.group === 'gate')!;
    const fences = L.placements.filter((p) => p.model === 'fence' && p.rotY === 0);
    expect(fences.length).toBeGreaterThan(5);
    for (const f of fences) expect(Math.abs(f.z - gate.z)).toBeLessThan(0.01);
  });

  it('has the animated critters and details, all in view of the camera', () => {
    const sc = L.scenery;
    const onScreen = (x: number, y: number, z: number, aspect: number) => {
      const p = project([x, y, z], cameraAt(0, aspect, true));
      return !!p && p.x > 0.03 && p.x < 0.97 && p.y > 0.12 && p.y < 0.97;
    };
    expect(sc.mounds).toHaveLength(3);
    expect(sc.crows.length).toBeGreaterThanOrEqual(4);
    expect(sc.spiders).toHaveLength(3);
    expect(sc.wisps.length).toBeGreaterThanOrEqual(12);
    expect(sc.cobwebs.length).toBeGreaterThanOrEqual(2);
    for (const aspect of [16 / 10, 16 / 9]) {
      expect(onScreen(sc.cat.x, sc.cat.y, sc.cat.z, aspect), 'cat').toBe(true);
      expect(onScreen(sc.owl.x, sc.owl.y, sc.owl.z, aspect), 'owl').toBe(true);
      expect(onScreen(sc.cauldron.x, sc.cauldron.y, sc.cauldron.z, aspect), 'cauldron').toBe(true);
      expect(onScreen(sc.openCoffin.x, 0.5, sc.openCoffin.z, aspect), 'coffin').toBe(true);
      for (const m of sc.mounds) expect(onScreen(m.x, 0.3, m.z, aspect), 'mound').toBe(true);
      for (const s of sc.spiders) expect(onScreen(s.x, s.topY - s.drop / 2, s.z, aspect), 'spider').toBe(true);
      for (const c of sc.crows) expect(onScreen(c.x, c.y, c.z, aspect), 'crow').toBe(true);
    }
  });
  it('puts the cat on a gravestone, the owl on a branch of a dead tree and crows on posts and trees', () => {
    const sc = L.scenery;
    const stone = L.placements.find((p) => p.group === 'critter' && p.model === 'gravestone')!;
    expect(Math.hypot(stone.x - sc.cat.x, stone.z - sc.cat.z)).toBeLessThan(0.01);
    expect(sc.cat.y).toBeGreaterThan(1.5);
    const dead = L.placements.filter((p) => p.group === 'tree' && p.model.startsWith('tree_dead'));
    const b = sc.owl.branch;
    expect(dead.some((t) => Math.hypot(t.x - b[0], t.z - b[2]) < 0.01)).toBe(true);
    expect(sc.owl.y).toBeGreaterThan(b[4]);
    const pillars = L.placements.filter((p) => p.model === 'fence_pillar');
    expect(sc.crows.filter((c) => pillars.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 0.01)).length).toBeGreaterThanOrEqual(3);
    expect(sc.crows.some((c) => c.y > 2.5)).toBe(true);
    // The reserved spots are never built over.
    for (const g of ['critter']) expect(L.placements.filter((p) => p.group === g).length).toBeGreaterThanOrEqual(6);
  });
  it('has more trees, graves and glowing mushrooms, with a lean on many of them', () => {
    expect(L.placements.filter((p) => p.group === 'tree').length).toBeGreaterThanOrEqual(36);
    expect(L.placements.filter((p) => p.group === 'oldGrave').length).toBeGreaterThanOrEqual(50);
    expect(L.placements.filter((p) => p.model.startsWith('forest_mushroom')).length).toBeGreaterThanOrEqual(6);
    expect(L.glows.filter((g) => g.kind === 'mushroom').length).toBeGreaterThanOrEqual(6);
    expect(L.glows.some((g) => g.kind === 'cauldron')).toBe(true);
    expect(L.placements.filter((p) => p.tilt && (Math.abs(p.tilt[0]) > 0.005 || Math.abs(p.tilt[1]) > 0.005)).length).toBeGreaterThan(40);
    // Variety: many different kinds, and no two graves with exactly the same turn and size.
    expect(new Set(L.placements.filter((p) => p.group === 'tree').map((p) => p.model)).size).toBeGreaterThanOrEqual(8);
    const graves = L.placements.filter((p) => p.group === 'oldGrave');
    expect(new Set(graves.map((p) => `${p.model}|${p.rotY.toFixed(3)}|${p.scale.toFixed(3)}`)).size).toBe(graves.length);
    const kinds = new Set(graves.map((p) => p.model));
    for (const k of ['grave_A', 'grave_B', 'grave_A_destroyed', 'gravemarker_A', 'gravemarker_B', 'gravestone']) expect(kinds.has(k as never), k).toBe(true);
    const smalls = new Set(L.placements.filter((p) => p.group === 'small').map((p) => p.model));
    for (const k of ['post_skull', 'shrine_candles', 'fence_broken', 'forest_cauldron']) {
      expect(smalls.has(k as never) || L.placements.some((p) => p.model === k), k).toBe(true);
    }
  });
});

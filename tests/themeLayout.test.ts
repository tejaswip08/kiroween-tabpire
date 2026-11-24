// Feature: themes, Properties 10, 11 and 12: per-theme layouts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FLAT_GROUPS, LAYOUT_SEED, MODELS, PATH_HALF_WIDTH, blocksMoon, buildLayout, footprintOf, footprintsOverlap, insideGround, layout, type Placement,
} from '../lib/scene/layout';
import { DOOR_CLEARANCE, themeScene } from '../lib/scene/themeLayout';
import { THEMES, THEME_IDS, themeById, type ThemeId } from '../lib/themes';
import { WEATHER } from '../lib/scene/weather';
const OTHERS = THEME_IDS.filter((t) => t !== 'crypt');
const BASE_GROUPS: Placement['group'][] = ['path', 'gate', 'crypt', 'fence', 'newGrave', 'coffin', 'candle'];
const seeds = fc.constantFrom(LAYOUT_SEED, 7, 99, 2024);
const themed = (p: Placement) => p.group === 'themed';
const solid = (ps: Placement[]) => ps.filter((p) => !FLAT_GROUPS.includes(p.group));
const fileOf = (id: keyof typeof MODELS) => {
  const s = MODELS[id].source;
  return resolve(__dirname, '../public/models', s === 'custom' ? 'coffin.glb' : s === 'quaternius' ? `quaternius/${id}.glb` : `kaykit/${id}.gltf`);
};
const key = (p: Placement) => JSON.stringify(p);
/** The base layout per seed. Building one is slow, and the properties only use four seeds, so each is built once. */
const baseCache = new Map<number, ReturnType<typeof buildLayout>>();
const baseFor = (seed: number) => {
  let b = baseCache.get(seed);
  if (!b) baseCache.set(seed, (b = buildLayout(seed)));
  return b;
};

describe('Property 10: theme layouts never disturb the base', () => {
  it('keeps the base groups and the pinned trees unchanged for any seed', () => {
    fc.assert(
      fc.property(seeds, fc.constantFrom(...OTHERS), (seed, id) => {
        const base = baseFor(seed);
        const out = themeScene(id, seed).layout;
        const have = new Set(out.placements.map(key));
        for (const p of base.placements) if (BASE_GROUPS.includes(p.group)) expect(have.has(key(p)), p.id).toBe(true);
        const { owl, crows } = base.scenery;
        const pinned = base.placements.filter(
          (p) => p.group === 'tree' && ((Math.abs(p.x - owl.branch[0]) < 1e-6 && Math.abs(p.z - owl.branch[2]) < 1e-6) || crows.some((c) => Math.abs(p.x - (c.x - 0.3)) < 1e-6 && Math.abs(p.z - (c.z - 0.4)) < 1e-6)),
        );
        expect(pinned.length).toBeGreaterThanOrEqual(3);
        for (const p of pinned) expect(have.has(key(p)), p.id).toBe(true);
      }),
      { numRuns: 8 },
    );
  });
  it('shares the scenery, ghost spots, path and lights with the base, and adds no real lights', () => {
    for (const id of OTHERS) {
      const out = themeScene(id).layout;
      expect(out.scenery).toBe(layout().scenery);
      expect(out.ghostSpots).toBe(layout().ghostSpots);
      expect(out.pathCentres).toBe(layout().pathCentres);
      expect(out.lights).toBe(layout().lights);
      expect(out.cryptDoor).toBe(layout().cryptDoor);
    }
  });
  it('does not change the base layout object (the Crypt stays the same after building every theme)', () => {
    const before = JSON.stringify(layout());
    for (const id of THEME_IDS) themeScene(id);
    expect(JSON.stringify(layout())).toBe(before);
  });
  it('only removes loose scenery from the base, and only Frozen Cemetery drops or swaps', () => {
    for (const id of OTHERS) {
      const out = themeScene(id).layout;
      const have = new Set(out.placements.map((p) => p.id));
      const removed = layout().placements.filter((p) => !have.has(p.id));
      for (const p of removed) expect(['oldGrave', 'small', 'tree']).toContain(p.group);
    }
  });
});

describe('Property 11: themed props fit the yard', () => {
  it('places every themed prop inside the ground, clear of everything else, the path, the crypt door and the moon', () => {
    fc.assert(
      fc.property(seeds, fc.constantFrom(...OTHERS), (seed, id) => {
        const s = themeScene(id, seed);
        const all = solid(s.layout.placements);
        const door = s.layout.cryptDoor;
        for (const p of all.filter(themed)) {
          const f = footprintOf(p);
          expect(insideGround(f), p.id).toBe(true);
          expect(blocksMoon(p), p.id).toBe(false);
          for (const c of s.layout.pathCentres) expect(Math.hypot(c.x - p.x, c.z - p.z), p.id).toBeGreaterThan(PATH_HALF_WIDTH + Math.min(f.hx, f.hz) * 0.5);
          for (const q of all) if (q !== p) expect(footprintsOverlap(f, footprintOf(q)), `${p.id} ${q.id}`).toBe(false);
        }
        // Added props keep their distance from the door. A swapped tree stands where a base tree already stood.
        for (const p of all.filter(themed)) {
          if (Math.hypot(p.x - door.x, p.z - door.z) >= DOOR_CLEARANCE) continue;
          expect(baseFor(seed).placements.some((b) => b.group === 'tree' && b.x === p.x && b.z === p.z), p.id).toBe(true);
        }
      }),
      { numRuns: 8 },
    );
  });
  it('keeps every base prop that remains free of overlaps too', () => {
    for (const id of OTHERS) {
      const all = solid(themeScene(id).layout.placements);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          if (!themed(all[i]!) && !themed(all[j]!)) continue;
          expect(footprintsOverlap(footprintOf(all[i]!), footprintOf(all[j]!)), `${all[i]!.id} ${all[j]!.id}`).toBe(false);
        }
      }
    }
  });
  it('uses the themed group and ids theme-<model>-<n>, with no duplicate ids', () => {
    for (const id of OTHERS) {
      const ps = themeScene(id).layout.placements;
      expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length);
      for (const p of ps.filter(themed)) expect(p.id).toMatch(new RegExp(`^theme-${p.model}-\\d+$`));
    }
  });
});

describe('Property 12: theme layouts are deterministic and complete', () => {
  it('gives equal results for equal arguments', () => {
    fc.assert(
      fc.property(seeds, fc.constantFrom(...THEME_IDS), (seed, id) => {
        const a = themeScene(id, seed);
        const b = themeScene(id, seed);
        expect(b).toEqual(a);
        expect(b.layout.placements).toEqual(a.layout.placements);
      }),
      { numRuns: 12 },
    );
  });
  it.each(THEME_IDS)('%s has every required model for the default seed', (id) => {
    const s = themeScene(id);
    const used = new Set(s.layout.placements.map((p) => p.model));
    for (const m of themeById(id).props.required) expect(used.has(m), `${id}: ${m}`).toBe(true);
  });
  it.each(THEME_IDS)('%s lists only catalogue models that have a file', (id) => {
    const s = themeScene(id);
    expect(new Set(s.models).size).toBe(s.models.length);
    for (const m of s.models) {
      expect(MODELS[m], m).toBeDefined();
      expect(existsSync(fileOf(m)), m).toBe(true);
    }
    for (const p of s.layout.placements) if (MODELS[p.model].source !== 'procedural') expect(s.models).toContain(p.model);
  });
  it('the prop tables use only catalogue models that have a file', () => {
    for (const t of THEMES) {
      const ids = [
        ...(t.props.drop?.models ?? []), ...(t.props.swaps ?? []).flatMap((w) => [...w.from, ...w.to]),
        ...t.props.adds.map((a) => a.model), ...t.props.required,
      ];
      for (const m of ids) {
        expect(MODELS[m], `${t.id}: ${m}`).toBeDefined();
        expect(existsSync(fileOf(m)), `${t.id}: ${m}`).toBe(true);
      }
      for (const a of t.props.adds) {
        expect(a.count).toBeGreaterThan(0);
        expect(a.scale[0]).toBeLessThanOrEqual(a.scale[1]);
      }
    }
  });
  it('the Crypt has no extra props and its tables are empty', () => {
    expect(themeById('crypt').props).toEqual({ adds: [], required: [] });
    expect(themeScene('crypt').layout.placements.some(themed)).toBe(false);
  });
});

describe('per-theme counts (design table)', () => {
  // Each entry: model, the number the table asks for, and the least that must be placed (some rules may find fewer spots).
  const WANT: Record<Exclude<ThemeId, 'crypt'>, [string, number, number][]> = {
    pumpkin: [['farm_barn', 1, 1], ['farm_silo', 1, 1], ['farm_corn', 8, 6], ['farm_pumpkin', 6, 4], ['farm_fence', 3, 2]],
    forest: [['forest_mushroom_king', 2, 1], ['forest_potion_a', 1, 1], ['forest_potion_b', 1, 1], ['forest_rock_large', 2, 1], ['forest_rocks', 1, 1]],
    frost: [['frost_pine_a', 1, 1], ['frost_pine_b', 1, 1], ['frost_pines', 1, 1], ['frost_rock', 3, 2]],
    bloodmoon: [['blood_ruins', 1, 1], ['blood_column', 4, 3], ['blood_column_round', 3, 2], ['blood_pedestal', 2, 1]],
    castle: [['castle_fortress', 1, 1], ['castle_wall_towers', 2, 1], ['castle_torch', 4, 3], ['castle_banner', 1, 1], ['castle_stone_wall', 2, 1]],
  };
  it.each(OTHERS)('%s places the design counts within tolerance', (id) => {
    const ps = themeScene(id).layout.placements;
    for (const [model, want, least] of WANT[id as keyof typeof WANT]) {
      const n = ps.filter((p) => p.model === model && themed(p)).length;
      // Frozen Cemetery also swaps up to two trees for the pines.
      const extra = id === 'frost' && model.startsWith('frost_pine_') ? 2 : 0;
      expect(n, `${id}: ${model}`).toBeGreaterThanOrEqual(least);
      expect(n, `${id}: ${model}`).toBeLessThanOrEqual(want + extra);
    }
  });
  it('Frozen Cemetery drops the decorated tree and swaps at most two trees', () => {
    const out = themeScene('frost').layout.placements;
    expect(out.some((p) => p.model === 'tree_dead_large_decorated')).toBe(false);
    const swapped = out.filter((p) => p.model.startsWith('frost_pine_') && layout().placements.some((b) => b.group === 'tree' && b.x === p.x && b.z === p.z));
    expect(swapped.length).toBeLessThanOrEqual(2);
  });
  it('the castle has one glow and one weather anchor per lit torch, and no extra point lights', () => {
    const s = themeScene('castle');
    const torches = s.layout.placements.filter((p) => p.model === 'castle_torch');
    expect(s.anchors).toHaveLength(torches.length);
    expect(s.layout.glows.filter((g) => g.kind === 'torch')).toHaveLength(torches.length);
    expect(s.layout.lights).toBe(layout().lights);
    for (const id of THEME_IDS) if (id !== 'castle') expect(themeScene(id).anchors).toEqual([]);
  });
  it('returns the weather spec of the theme', () => {
    for (const t of THEMES) expect(themeScene(t.id).weather).toBe(t.weather ? WEATHER[t.weather] : null);
  });
});

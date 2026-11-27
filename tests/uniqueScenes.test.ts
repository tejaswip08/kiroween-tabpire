// The unique theme scenes (.kiro/specs/themes/unique-scenes.md). Every theme listed in UNIQUE_SCENES is checked here,
// so a theme added later is covered without a new test. The Crypt has its own tests and is not part of this file.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aimMoon, createDisplay } from '../entrypoints/newtab/layers/scene/display';
import { cameraAt, projectDirection } from '../lib/scene/camera';
import { BUDGET } from '../lib/scene/config';
import {
  GROUND, LAYOUT_SEED, MODELS, cutByScreenEdge, footprintOf, footprintsOverlap, insideGround, layout, modelFile, type ModelId,
} from '../lib/scene/layout';
import { sceneState } from '../lib/scene/meaning';
import { CLOUD_LANES, MOON_KEEP_OUT_DEG, cloudDistanceToMoon, cloudLanesFor, cloudPuffs, cloudU, moonDirection } from '../lib/scene/sky';
import { themeScene } from '../lib/scene/themeLayout';
import { PUMPKIN_MOON } from '../lib/scene/uniqueScenes/pumpkin';
import { UNIQUE_SCENES } from '../lib/scene/uniqueScenes';
import { MAX_SINK } from '../lib/scene/uniqueScenes/frostIce';
import {
  CARD_BAND_Y, CENTRE_INSIDE_X, CENTRE_X, NEAR_DEPTH, NEAR_MIDDLE_X, NEAR_TOP_Y, VIEW_ASPECTS, blocksMoonFor, solidFootprint, viewOf, type UniqueSceneSpec,
} from '../lib/scene/uniqueScenes/types';
import { WINDMILL_FOOT } from '../lib/scene/windmill';
import { THEME_IDS, themeById, type ThemeId } from '../lib/themes';

const UNIQUE = (Object.keys(UNIQUE_SCENES) as ThemeId[]);
const seeds = fc.constantFrom(LAYOUT_SEED, 7, 99, 2024);
const specOf = (id: ThemeId, seed = LAYOUT_SEED): UniqueSceneSpec => UNIQUE_SCENES[id]!(seed);
const fileOf = (id: ModelId) => {
  const s = MODELS[id].source;
  return resolve(__dirname, '../public/models', s === 'custom' ? 'coffin.glb' : s === 'quaternius' ? `quaternius/${id}.glb` : `kaykit/${id}.gltf`);
};
/** Models and groups of the Crypt's graveyard. A unique theme has none of them. */
const CRYPT_MODELS: readonly string[] = [
  'crypt', 'arch_gate', 'fence', 'fence_broken', 'fence_pillar', 'gravestone', 'grave_A', 'grave_A_destroyed', 'grave_B', 'gravemarker_A', 'gravemarker_B',
  'coffin_open', 'coffin_decorated', 'path_A', 'path_B', 'path_C', 'floor_dirt', 'dirt_mound', 'open_coffin_spot', 'post_lantern', 'post_skull',
];
const CRYPT_GROUPS: readonly string[] = ['path', 'gate', 'crypt', 'fence', 'newGrave', 'oldGrave', 'coffin', 'candle', 'critter'];

describe('the registry', () => {
  it('has the Pumpkin Patch, the Witch\'s Forest and the Frozen Cemetery, and the Crypt is never in it', () => {
    expect(UNIQUE).toEqual(expect.arrayContaining(['pumpkin', 'forest', 'frost']));
    expect(UNIQUE).not.toContain('crypt');
  });
  it('gives the spec through themeScene, and only for the themes that are registered', () => {
    for (const id of THEME_IDS) {
      const s = themeScene(id);
      if (UNIQUE.includes(id)) expect(s.unique?.id).toBe(id);
      else expect(s.unique, id).toBeUndefined();
    }
  });
  it('leaves the Crypt exactly as it was', () => {
    expect(themeScene('crypt').layout).toBe(layout());
    expect(themeScene('crypt').anchors).toEqual([]);
    expect(themeScene('crypt').weather).toBeNull();
  });
});

describe('distinct prop sets (rule 10)', () => {
  it('no unique theme shares more than 30 percent of its model files with another', () => {
    for (const a of UNIQUE) {
      for (const b of UNIQUE) {
        if (a === b) continue;
        const fa = new Set(specOf(a).models);
        const fb = new Set(specOf(b).models);
        const shared = [...fa].filter((m) => fb.has(m)).length;
        expect(shared, `${a} vs ${b}`).toBeLessThanOrEqual(0.3 * fa.size);
      }
    }
  });
});

describe.each(UNIQUE)('unique scene %s', (id) => {
  const scene = themeScene(id);
  const spec = scene.unique!;

  it('has a centrepiece that is one of its placements, and every id of it is a placement', () => {
    expect(spec.centrepiece.placement).toBeDefined();
    expect(spec.placements).toContain(spec.centrepiece.placement);
    expect(spec.centrepiece.ids).toContain(spec.centrepiece.placement.id);
    const ids = new Set(spec.placements.map((p) => p.id));
    for (const pid of spec.centrepiece.ids) expect(ids.has(pid), pid).toBe(true);
    expect(['centre', 'themed']).toContain(spec.centrepiece.placement.group);
  });

  it('is deterministic for a seed', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        expect(specOf(id, seed)).toEqual(specOf(id, seed));
      }),
      { numRuns: 8 },
    );
  });

  it('keeps every placement inside the ground, with no overlaps, for several seeds', () => {
    fc.assert(
      fc.property(seeds, (seed) => {
        const s = specOf(id, seed);
        for (const p of s.placements) expect(insideGround(footprintOf(p)), `${p.id} ${p.x},${p.z}`).toBe(true);
        for (let i = 0; i < s.placements.length; i++) {
          const fi = solidFootprint(s.placements[i]!);
          for (let j = i + 1; j < s.placements.length; j++) {
            const a = s.placements[i]!.id;
            const b = s.placements[j]!.id;
            // A banner on a tower or a flag on a wall (`spec.mounted`) is fixed to its host and overlaps it on purpose.
            if (s.mounted?.[a] === b || s.mounted?.[b] === a) continue;
            expect(footprintsOverlap(fi, solidFootprint(s.placements[j]!)), `${a} ${b}`).toBe(false);
          }
          for (const r of s.reserved) expect(footprintsOverlap(fi, r), `${s.placements[i]!.id} reserved`).toBe(false);
        }
      }),
      { numRuns: 4 },
    );
  });

  it.each(VIEW_ASPECTS.map((a) => [a.toFixed(2), a] as const))('follows the view rules at aspect %s', (_, aspect) => {
    const centre = spec.centrepiece.placement;
    const v = viewOf(centre, aspect)!;
    expect(v.cx, 'centrepiece centre x').toBeGreaterThanOrEqual(CENTRE_X[0]);
    expect(v.cx).toBeLessThanOrEqual(CENTRE_X[1]);
    expect(v.top, 'centrepiece top is above the card band').toBeLessThan(CARD_BAND_Y);
    expect(v.left).toBeGreaterThanOrEqual(CENTRE_INSIDE_X[0]);
    expect(v.right).toBeLessThanOrEqual(CENTRE_INSIDE_X[1]);
    let near = 0;
    for (const p of spec.placements) {
      const w = viewOf(p, aspect);
      expect(w, p.id).not.toBeNull();
      if (w!.depth >= NEAR_DEPTH) continue;
      near++;
      expect(cutByScreenEdge(p), `${p.id} is cut by the screen edge`).toBe(false);
      if (w!.cx >= NEAR_MIDDLE_X[0] && w!.cx <= NEAR_MIDDLE_X[1]) expect(w!.top, `${p.id} top`).toBeGreaterThanOrEqual(NEAR_TOP_Y);
    }
    // The Frozen Cemetery was rebuilt as a clear snowy graveyard: nothing stands closer than depth 17, so it has no near props to check.
    if (id !== 'frost') expect(near).toBeGreaterThan(0);
  });

  it('keeps tall props off the moon, and lists exactly its files as the theme models', () => {
    for (const p of spec.placements) expect(blocksMoonFor(p, spec.moon), p.id).toBe(false);
    expect([...scene.models].sort()).toEqual([...new Set(spec.models)].sort());
    expect([...scene.models].sort()).toEqual([...new Set(spec.placements.map((p) => p.model))].filter((m) => MODELS[m].source !== 'procedural').sort());
    for (const m of scene.models) expect(existsSync(fileOf(m)), m).toBe(true);
    expect(scene.layout.placements).toBe(spec.placements);
  });

  it('keeps clouds away from its moon, whatever its size', () => {
    const lanes = cloudLanesFor(spec.moon.scale);
    const keep = MOON_KEEP_OUT_DEG * spec.moon.scale;
    for (let t = 0; t <= 600; t += 7) {
      lanes.forEach((lane, li) => {
        for (const c of lane.clouds) {
          const d = cloudDistanceToMoon({ u: cloudU(c.u0, lane.speed, t, lane.uMin, lane.uMax), v: lane.v, a: c.a, b: c.b, lane: li });
          expect(d, `lane ${li} at ${t}s`).toBeGreaterThanOrEqual(keep - 1e-6);
        }
      });
    }
  });

  it('places its moon on the screen at its target for every window shape', () => {
    for (const aspect of VIEW_ASPECTS) {
      const display = createDisplay(sceneState({ cardCount: 5, starvingCount: 0, estimatedMb: 500, cryptCount: 0, crypted: 0, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false }), false);
      display.moonTarget = spec.moon.target;
      display.moonScale = spec.moon.scale;
      aimMoon(display, aspect);
      const t = spec.moon.target(aspect);
      const at = projectDirection([display.moon.x, display.moon.y, display.moon.z], cameraAt(0, aspect, true))!;
      expect(at.x).toBeCloseTo(t.x, 6);
      expect(at.y).toBeCloseTo(t.y, 6);
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(1);
      expect(t.y).toBeGreaterThan(0.1);
    }
  });

  it('stays within the lights and weather limits', () => {
    expect(spec.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    expect(scene.layout.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    if (spec.weather) expect(spec.weather.count).toBeLessThanOrEqual(2000);
    expect(scene.weather).toBe(spec.weather);
    expect(scene.weather).not.toBeNull();
    expect(spec.weather!.kind).toBe(themeById(id).weather);
    expect(scene.anchors).toBe(spec.anchors);
  });

  it('has none of the Crypt graveyard', () => {
    // The Frozen Cemetery sticks a few tilted gravestones in its lake: two kinds, a handful, never in a row (see `tests/frost.test.ts`).
    const iceStones = new Set(spec.ice?.stones ?? []);
    expect(iceStones.size).toBeLessThanOrEqual(8);
    for (const p of spec.placements) {
      if (!iceStones.has(p.id)) expect(CRYPT_MODELS, p.id).not.toContain(p.model);
      else expect(['gravestone', 'grave_B'], p.id).toContain(p.model);
      expect(CRYPT_GROUPS, p.id).not.toContain(p.group);
      expect(['themed', 'centre']).toContain(p.group);
    }
    const lay = scene.layout;
    expect(lay.scenery.crows).toEqual([]);
    expect(lay.scenery.spiders).toEqual([]);
    expect(lay.scenery.cobwebs).toEqual([]);
    expect(lay.scenery.wisps).toEqual([]);
    expect(lay.scenery.mounds).toEqual([]);
    expect(lay.pathCentres).toBe(spec.path.centre);
    expect(new Set(spec.placements.map((p) => p.id)).size).toBe(spec.placements.length);
  });

  it('is grounded by its catalogue: every model has a file and the unique scenes name only catalogue models', () => {
    for (const p of spec.placements) {
      expect(MODELS[p.model], p.id).toBeDefined();
      expect(p.scale).toBeGreaterThan(0);
      expect(p.x).toBeGreaterThanOrEqual(GROUND.minX);
      expect(p.x).toBeLessThanOrEqual(GROUND.maxX);
    }
    expect(modelFile(spec.placements[0]!.model)).toMatch(/models\//);
  });
});

describe.each(UNIQUE)('grounding of unique scene %s', (id) => {
  const spec = themeScene(id).unique!;
  it('lets only flagged placements sink below the ground, by at most the documented maximum', () => {
    for (const p of spec.placements) {
      const sink = spec.sunk?.[p.id];
      if (sink === undefined) expect(p.y, `${p.id} is not flagged as sunk`).toBeGreaterThanOrEqual(0);
      else {
        expect(sink, p.id).toBeGreaterThan(0);
        expect(sink, p.id).toBeLessThanOrEqual(MAX_SINK);
        expect(p.y, p.id).toBeCloseTo(-sink, 12);
      }
    }
    for (const sid of Object.keys(spec.sunk ?? {})) expect(spec.placements.some((p) => p.id === sid), sid).toBe(true);
  });
});
describe('cloud lanes for a bigger moon', () => {
  it('leave the Crypt lanes and puffs exactly as they were', () => {
    expect(cloudLanesFor(1)).toBe(CLOUD_LANES);
    expect(cloudPuffs()).toEqual(cloudPuffs(1));
  });
  it('move away from a bigger moon without changing how many clouds there are', () => {
    const big = cloudLanesFor(2);
    expect(big.map((l) => l.clouds.length)).toEqual(CLOUD_LANES.map((l) => l.clouds.length));
    expect(cloudPuffs(2)).toHaveLength(cloudPuffs(1).length);
  });
});

describe('the moon aim', () => {
  const display = () => createDisplay(sceneState({ cardCount: 5, starvingCount: 0, estimatedMb: 500, cryptCount: 0, crypted: 0, garlicCount: 0, staked: 0, coffined: 0, dawnReady: false }), false);
  it('keeps the Crypt moon where it was when no theme moon is set', () => {
    for (const aspect of VIEW_ASPECTS) {
      const d = display();
      aimMoon(d, aspect);
      const want = moonDirection(aspect);
      expect([d.moon.x, d.moon.y, d.moon.z]).toEqual([...want]);
      expect(d.moonScale).toBe(1);
    }
  });
});

describe('Pumpkin Patch (the template)', () => {
  const spec = themeScene('pumpkin').unique!;
  const count = (m: ModelId) => spec.placements.filter((p) => p.model === m).length;
  it('is a farm: barn centrepiece with a silo and windmill, corn, hay, fence, pumpkins and jack-o-lanterns', () => {
    expect(spec.centrepiece.placement.model).toBe('farm_barn');
    expect(spec.centrepiece.placement.group).toBe('centre');
    expect(spec.centrepiece.ids.map((i) => spec.placements.find((p) => p.id === i)!.model).sort()).toEqual(['farm_barn', 'farm_silo', 'farm_windmill']);
    expect(count('farm_corn')).toBeGreaterThanOrEqual(60);
    expect(count('farm_hay')).toBeGreaterThanOrEqual(8);
    expect(count('farm_fence')).toBeGreaterThanOrEqual(6);
    expect(count('farm_pumpkin')).toBeGreaterThanOrEqual(36);
    expect(count('pumpkin_orange_jackolantern')).toBeGreaterThanOrEqual(3);
    expect(new Set(spec.placements.filter((p) => p.model === 'farm_pumpkin').map((p) => p.scale.toFixed(1))).size).toBeGreaterThan(4);
    expect(spec.models).toEqual(expect.arrayContaining(['farm_barn', 'farm_silo', 'farm_windmill', 'farm_corn', 'farm_hay', 'farm_fence', 'farm_pumpkin', 'pumpkin_orange_jackolantern']));
  });
  it('has a harvest moon in the clear sky on the right, a dirt track, grass ground and falling leaves', () => {
    // 1.0 (was at least 1.1): the moon was made smaller so it floats higher, with clear sky under it.
    expect(PUMPKIN_MOON.scale).toBeGreaterThanOrEqual(1);
    for (const aspect of VIEW_ASPECTS) {
      const t = spec.moon.target(aspect);
      expect(t.y).toBeGreaterThanOrEqual(0.24);
      expect(t.y).toBeLessThanOrEqual(0.3);
      expect(t.x).toBeGreaterThan(0.74);
      expect(t.x).toBeLessThanOrEqual(0.92);
    }
    expect(spec.path.kind).toBe('dirt');
    expect(spec.ground.kind).toBe('grass');
    expect(spec.weather!.kind).toBe('leaves');
    expect(spec.sky).toEqual([]);
  });
  it('stands the windmill on the ground, lifted by the file offset, and glows its jack-o-lanterns', () => {
    const w = spec.placements.find((p) => p.model === 'farm_windmill')!;
    expect(w.y).toBeCloseTo(WINDMILL_FOOT * w.scale, 9);
    const jacks = spec.placements.filter((p) => p.model === 'pumpkin_orange_jackolantern');
    for (const j of jacks) expect(spec.glows.some((g) => g.kind === 'jackOLantern' && g.x === j.x && g.z === j.z)).toBe(true);
    expect(spec.lights.length).toBeGreaterThan(0);
  });
});

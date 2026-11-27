import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET, QUALITY } from '../lib/scene/config';
import { MODELS, buildLayout, modelFile, modelInfo, type ModelId } from '../lib/scene/layout';
import { EXTRAS } from '../lib/scene/depth';
import { themeScene } from '../lib/scene/themeLayout';
import { weatherDraws, weatherTriangles } from '../lib/scene/weather';
import type { UniqueSceneSpec } from '../lib/scene/uniqueScenes/types';
import { THEME_IDS, type ThemeId } from '../lib/themes';

const ROOT = join(__dirname, '..', 'public', 'models');

interface Gltf {
  scene?: number;
  scenes?: { nodes: number[] }[];
  nodes: { mesh?: number; children?: number[] }[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number; mode?: number }[] }[];
  accessors: { count: number }[];
}

function readGlb(file: string): Gltf {
  const b = readFileSync(file);
  expect(b.toString('utf8', 0, 4)).toBe('glTF');
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))) as Gltf;
}

/** Triangles and mesh parts (one draw call each when instanced) of one model file. */
function measure(j: Gltf): { triangles: number; parts: number } {
  let triangles = 0;
  let parts = 0;
  const visit = (i: number) => {
    const n = j.nodes[i]!;
    if (n.mesh !== undefined) {
      for (const pr of j.meshes[n.mesh]!.primitives) {
        const count = pr.indices !== undefined ? j.accessors[pr.indices]!.count : j.accessors[pr.attributes.POSITION]!.count;
        triangles += count / 3;
        parts++;
      }
    }
    n.children?.forEach(visit);
  };
  const roots = j.scenes?.[j.scene ?? 0]?.nodes ?? [0];
  roots.forEach(visit);
  return { triangles, parts };
}

const fileOf = (id: ModelId): Gltf => {
  const src = MODELS[id].source;
  if (src === 'custom') return readGlb(join(ROOT, 'coffin.glb'));
  if (src === 'quaternius') return readGlb(join(ROOT, 'quaternius', `${id}.glb`));
  return JSON.parse(readFileSync(join(ROOT, 'kaykit', `${id}.gltf`), 'utf8')) as Gltf;
};
/** Models the scene draws itself have no file. */
const hasFile = (id: ModelId) => MODELS[id].source !== 'procedural';

const L = buildLayout();
const measured = new Map<ModelId, { triangles: number; parts: number }>();
for (const id of Object.keys(MODELS) as ModelId[]) {
  measured.set(id, hasFile(id) ? measure(fileOf(id)) : { triangles: MODELS[id].tris, parts: 1 });
}

/** Draw calls for everything that is not a prop (see the design's performance plan). */
const OTHER_DRAWS = {
  skyDome: 1, moon: 3, mist: 5, clouds: 1, witch: 2, bats: 1, ghosts: 1, embers: 1, weather: 0, glowPools: 1, flameGlows: 1,
  /** Bloom mip chain, Vignette, tone mapping and copies. */
  postPasses: 12,
};

describe('model catalogue', () => {
  it('matches the triangle counts in the model files (a model that draws only some of its parts uses at most the file total)', () => {
    for (const id of Object.keys(MODELS) as ModelId[]) {
      if (!hasFile(id)) continue;
      const info = modelInfo(id);
      if (info.parts) expect(info.tris, id).toBeLessThanOrEqual(measured.get(id)!.triangles);
      else expect(info.tris, id).toBe(measured.get(id)!.triangles);
    }
  });
});

describe('scene budget', () => {
  const counts = new Map<ModelId, number>();
  for (const p of L.placements) counts.set(p.model, (counts.get(p.model) ?? 0) + 1);

  it('stays within the 215,000 triangle budget with every instance at full capacity, shadow pass included', () => {
    expect(BUDGET.sceneTriangles).toBe(215_000);
    let total = 0;
    for (const [id, n] of counts) {
      const t = MODELS[id].tris * n;
      total += t + (MODELS[id].shadow ? t : 0);
    }
    // Everything the scene draws itself (the far village, the critters and the details).
    total += Object.values(EXTRAS).reduce((sum, e) => sum + e.tris, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(BUDGET.sceneTriangles);
  });
  it('stays within the 150 draw call plan', () => {
    expect(BUDGET.sceneDrawCalls).toBe(150);
    let propDraws = 0;
    for (const id of counts.keys()) {
      const parts = modelInfo(id).parts?.length ?? measured.get(id)!.parts;
      propDraws += parts + (MODELS[id].shadow ? parts : 0);
    }
    const other = Object.values(OTHER_DRAWS).reduce((a, b) => a + b, 0) + Object.values(EXTRAS).reduce((a, e) => a + e.calls, 0);
    expect(propDraws + other).toBeLessThanOrEqual(BUDGET.sceneDrawCalls);
  });
  it('shares draw calls between repeated models', () => {
    const instances = L.placements.length;
    const models = counts.size;
    expect(models).toBeLessThan(instances / 2);
  });
  it('uses at most the allowed real lights', () => {
    expect(L.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
  });
  it('only uses models that exist as files', () => {
    for (const id of counts.keys()) if (hasFile(id)) expect(() => readFileSync(join(__dirname, '..', 'public', modelFile(id)))).not.toThrow();
  });
});

describe('vampire budget', () => {
  const vampire = readGlb(join(ROOT, 'vampire.glb'));
  it('has one mesh within the triangle budget', () => {
    const { triangles, parts } = measure(vampire);
    expect(parts).toBe(1);
    expect(triangles).toBeGreaterThan(1000);
    expect(triangles).toBeLessThanOrEqual(BUDGET.vampireTriangles);
  });
  it('has no skeleton and no animation (so poses move the whole body)', () => {
    const raw = vampire as unknown as Record<string, unknown>;
    expect(raw.skins).toBeUndefined();
    expect(raw.animations).toBeUndefined();
  });
  it('has a small coffin model', () => {
    const coffin = measure(readGlb(join(ROOT, 'coffin.glb')));
    expect(coffin.triangles).toBeLessThan(2000);
  });
});

/** Draw calls of the shared layers a unique theme turns on (the sky, the moon, the glows and the post passes are always on). */
function sharedDraws(u: UniqueSceneSpec): number {
  const o = OTHER_DRAWS;
  return (
    o.skyDome + o.moon + o.glowPools + o.flameGlows + o.postPasses +
    (u.layers.clouds ? o.clouds : 0) + (u.layers.witch ? o.witch : 0) + (u.layers.bats > 0 ? o.bats : 0) +
    (u.layers.ghosts ? o.ghosts : 0) + (u.layers.mist ? o.mist : 0) + (u.layers.embers ? o.embers : 0)
  );
}

/**
 * The plan of one theme: triangles (shadow pass and two per weather particle) and draw calls. The Crypt and the themes
 * not yet moved count the Crypt's extras and every shared layer. A unique theme counts its placements (with the shadow
 * pass), its own `extras`, the shared layers it turns on and its weather.
 */
function plan(id: ThemeId) {
  const { layout: lay, weather, unique } = themeScene(id);
  const counts = new Map<ModelId, number>();
  for (const p of lay.placements) counts.set(p.model, (counts.get(p.model) ?? 0) + 1);
  let tris = (unique ? unique.extras.tris : Object.values(EXTRAS).reduce((sum, e) => sum + e.tris, 0)) + weatherTriangles(weather);
  let draws =
    (unique ? sharedDraws(unique) + unique.extras.calls : Object.values(OTHER_DRAWS).reduce((a, b) => a + b, 0) + Object.values(EXTRAS).reduce((a, e) => a + e.calls, 0)) +
    weatherDraws(weather);
  for (const [m, n] of counts) {
    const t = MODELS[m].tris * n;
    tris += t + (MODELS[m].shadow ? t : 0);
    const parts = modelInfo(m).parts?.length ?? measured.get(m)!.parts;
    draws += parts + (MODELS[m].shadow ? parts : 0);
  }
  return { lay, weather, counts, tris, draws, unique };
}

describe.each(THEME_IDS)('budget of theme %s (Property 13)', (id) => {
  const { lay, weather, counts, tris, draws } = plan(id);
  it('stays within the triangle budget (shadow pass and weather included)', () => {
    expect(weatherTriangles(weather)).toBe(weather ? 2 * weather.count : 0);
    expect(tris).toBeLessThanOrEqual(BUDGET.sceneTriangles);
  });
  it('stays within 150 draw calls (weather is one)', () => {
    expect(weatherDraws(weather)).toBe(weather ? 1 : 0);
    expect(draws).toBeLessThanOrEqual(BUDGET.sceneDrawCalls);
  });
  it('uses at most the allowed real lights (torch glows are not lights)', () => {
    expect(lay.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
  });
  it('places only models whose tris entry equals the file', () => {
    for (const m of counts.keys()) {
      if (!hasFile(m)) continue;
      const info = modelInfo(m);
      if (info.parts) expect(info.tris, m).toBeLessThanOrEqual(measured.get(m)!.triangles);
      else expect(info.tris, m).toBe(measured.get(m)!.triangles);
    }
  });
  it('lists every model with a file in its model list', () => {
    expect([...themeScene(id).models].sort()).toEqual([...counts.keys()].filter(hasFile).sort());
  });
});

describe.each(THEME_IDS.filter((id) => themeScene(id).unique))('the plan of unique theme %s', (id) => {
  const { unique, tris, draws, counts, weather } = plan(id);
  it('counts its placements with the shadow pass, its extras, the shared layers it turns on and its weather', () => {
    let props = 0;
    for (const [m, n] of counts) props += MODELS[m].tris * n * (MODELS[m].shadow ? 2 : 1);
    expect(props).toBeGreaterThan(0);
    expect(tris).toBe(props + unique!.extras.tris + weatherTriangles(weather));
    const parts = [...counts.keys()].reduce((sum, m) => sum + (modelInfo(m).parts?.length ?? measured.get(m)!.parts) * (MODELS[m].shadow ? 2 : 1), 0);
    expect(draws).toBe(parts + sharedDraws(unique!) + unique!.extras.calls + weatherDraws(weather));
  });
  it('never counts the Crypt village and critters', () => {
    const cryptExtras = Object.values(EXTRAS).reduce((sum, e) => sum + e.tris, 0);
    // The Witch's Forest builds dozens of trees itself, and the Pumpkin Patch its tree, skeletons, haunted house and extra trees
    // and far scenery with its dusk clouds (about 64k), so their own parts may outweigh the village; the village is still not counted.
    // Raised from 64,000 for the Pumpkin Patch's far scenery (hills, farmhouses, steeple, water tower, trees, field-edge props).
    expect(unique!.extras.tris).toBeLessThan(Math.max(cryptExtras, 66_000));
  });
  it('stays within the budgets', () => {
    expect(tris).toBeLessThanOrEqual(BUDGET.sceneTriangles);
    expect(draws).toBeLessThanOrEqual(BUDGET.sceneDrawCalls);
    expect(unique!.lights.length).toBeLessThanOrEqual(BUDGET.maxPointLights);
    expect(weather!.count).toBeLessThanOrEqual(2000);
  });
});

describe('the Crypt plan is the plan before the themes work', () => {
  it('uses the base layout and has no weather', () => {
    const crypt = plan('crypt');
    expect(crypt.weather).toBeNull();
    expect(crypt.lay.placements).toEqual(L.placements);
    // Requirement changed: the Crypt's backdrop behind the fence (dead trees, pines, two mausoleums, broken fence, a lamp post and
    // tombstones), the far village and the depth fog. Still well inside BUDGET.sceneTriangles and BUDGET.sceneDrawCalls.
    expect(crypt.tris).toBe(145_115);
    expect(crypt.draws).toBe(124);
  });
  it('keeps the render quality settings', () => {
    expect(QUALITY).toEqual({
      sceneDpr: 1, sceneAntialias: false, bloomMipmapBlur: true, shadowMapSize: 2048, shadowRefreshFrames: 20, portraitDprMax: 1.25, portraitAntialias: true,
    });
  });
});

describe('bundle size', () => {
  const OUT = join(__dirname, '..', '.output', 'chrome-mv3');
  const size = (dir: string): number =>
    readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
  it.skipIf(!existsSync(OUT))('stays within the bundle limit when the built output exists', () => {
    expect(size(OUT)).toBeLessThanOrEqual(BUDGET.maxBundleBytes);
  });
});

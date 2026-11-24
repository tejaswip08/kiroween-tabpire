import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET, QUALITY } from '../lib/scene/config';
import { MODELS, buildLayout, modelFile, modelInfo, type ModelId } from '../lib/scene/layout';
import { EXTRAS } from '../lib/scene/depth';
import { themeScene } from '../lib/scene/themeLayout';
import { weatherDraws, weatherTriangles } from '../lib/scene/weather';
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

  it('stays within the 200,000 triangle budget with every instance at full capacity, shadow pass included', () => {
    expect(BUDGET.sceneTriangles).toBe(200_000);
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

/** The plan of one theme: triangles (shadow pass and two per weather particle) and draw calls. */
function plan(id: ThemeId) {
  const { layout: lay, weather } = themeScene(id);
  const counts = new Map<ModelId, number>();
  for (const p of lay.placements) counts.set(p.model, (counts.get(p.model) ?? 0) + 1);
  let tris = Object.values(EXTRAS).reduce((sum, e) => sum + e.tris, 0) + weatherTriangles(weather);
  let draws = Object.values(OTHER_DRAWS).reduce((a, b) => a + b, 0) + Object.values(EXTRAS).reduce((a, e) => a + e.calls, 0) + weatherDraws(weather);
  for (const [m, n] of counts) {
    const t = MODELS[m].tris * n;
    tris += t + (MODELS[m].shadow ? t : 0);
    const parts = modelInfo(m).parts?.length ?? measured.get(m)!.parts;
    draws += parts + (MODELS[m].shadow ? parts : 0);
  }
  return { lay, weather, counts, tris, draws };
}

describe.each(THEME_IDS)('budget of theme %s (Property 13)', (id) => {
  const { lay, weather, counts, tris, draws } = plan(id);
  it('stays within 200,000 triangles (shadow pass and weather included)', () => {
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

describe('the Crypt plan is the plan before the themes work', () => {
  it('uses the base layout and has no weather', () => {
    const crypt = plan('crypt');
    expect(crypt.weather).toBeNull();
    expect(crypt.lay.placements).toEqual(L.placements);
    expect(crypt.tris).toBe(157_876);
    expect(crypt.draws).toBe(123);
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

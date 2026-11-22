import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET } from '../lib/scene/config';
import { MODELS, buildLayout, modelFile, type ModelId } from '../lib/scene/layout';

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

const kaykit = (id: ModelId): Gltf =>
  MODELS[id].source === 'quaternius'
    ? readGlb(join(ROOT, 'quaternius', `${id}.glb`))
    : (JSON.parse(readFileSync(join(ROOT, 'kaykit', `${id}.gltf`), 'utf8')) as Gltf);

const L = buildLayout();
const measured = new Map<ModelId, { triangles: number; parts: number }>();
for (const id of Object.keys(MODELS) as ModelId[]) measured.set(id, measure(kaykit(id)));

/** Draw calls for everything that is not a prop (see the design's performance plan). */
const OTHER_DRAWS = {
  skyDome: 1, moon: 3, mist: 4, clouds: 1, witch: 2, bats: 1, ghosts: 1, embers: 1, glowPools: 1, flameGlows: 1,
  /** Bloom mip chain, Vignette, tone mapping and copies. */
  postPasses: 12,
};

describe('model catalogue', () => {
  it('matches the triangle counts in the Kaykit files', () => {
    for (const id of Object.keys(MODELS) as ModelId[]) {
      expect(MODELS[id].tris, id).toBe(measured.get(id)!.triangles);
    }
  });
});

describe('scene budget', () => {
  const counts = new Map<ModelId, number>();
  for (const p of L.placements) counts.set(p.model, (counts.get(p.model) ?? 0) + 1);

  it('stays within the triangle budget with every instance at full capacity, shadow pass included', () => {
    let total = 0;
    for (const [id, n] of counts) {
      const t = measured.get(id)!.triangles * n;
      total += t + (MODELS[id].shadow ? t : 0);
    }
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(BUDGET.sceneTriangles);
  });
  it('stays within the draw call plan', () => {
    let propDraws = 0;
    for (const id of counts.keys()) {
      const parts = measured.get(id)!.parts;
      propDraws += parts + (MODELS[id].shadow ? parts : 0);
    }
    const other = Object.values(OTHER_DRAWS).reduce((a, b) => a + b, 0);
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
    for (const id of counts.keys()) expect(() => readFileSync(join(__dirname, '..', 'public', modelFile(id)))).not.toThrow();
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

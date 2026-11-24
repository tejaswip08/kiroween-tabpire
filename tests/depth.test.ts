import { describe, expect, it } from 'vitest';
import type { Mesh } from 'three';
import { cornerIndices, worldPositions } from '../entrypoints/newtab/layers/scene/geometryTools';
import { BUDGET } from '../lib/scene/config';
import {
  CHURCH, EXTRAS, FAR_EMBED, FAR_HILLS, farGroundY, farSeatY, FAR_ITEMS, FAR_MODELS, FAR_WINDOW_COUNT, LOW_CLOUD_LAYERS, LOW_CLOUD_MOON_FADE_DEG, farTriangles,
  lowCloudEdgeFade, lowCloudMoonVisibility, lowCloudPuffs, lowCloudX,
} from '../lib/scene/depth';
import { MOON_KEEP_OUT_DEG } from '../lib/scene/sky';
import { FRONT_Z, hubOf, splitBlades } from '../lib/scene/windmill';
import { loadGlbGeometry } from './helpers/glb';

describe('the far village', () => {
  it('is far behind the yard, on the hills, with a church, barn, windmill, fortress and ruins', () => {
    const kinds = new Set(FAR_ITEMS.map((i) => i.kind));
    for (const k of ['church', 'barn', 'windmill', 'fortress', 'ruins', 'house'] as const) expect(kinds.has(k), k).toBe(true);
    for (const i of FAR_ITEMS) expect(i.z, i.id).toBeLessThan(-80);
    for (const h of FAR_HILLS) expect(h.z).toBeLessThan(-80);
  });
  it('has a few warm lit windows, and the church has exactly one', () => {
    expect(FAR_WINDOW_COUNT).toBeGreaterThanOrEqual(8);
    expect(FAR_ITEMS.find((i) => i.kind === 'church')!.windows).toHaveLength(1);
    for (const i of FAR_ITEMS) for (const w of i.windows) expect(w.every(Number.isFinite)).toBe(true);
  });
  it('sits on the hills: every building starts at the hill surface under it, on a hill and never on flat ground', () => {
    for (const item of FAR_ITEMS) {
      expect(item.y, item.id).toBeCloseTo(farGroundY(item.x, item.z), 6);
      expect(item.y, item.id).toBeGreaterThan(3);
    }
  });
  it('has one continuous hill ridge across the whole background, with no gap down to flat ground', () => {
    for (let x = -90; x <= 90; x += 0.5) expect(farGroundY(x, -90), `x ${x}`).toBeGreaterThan(3);
  });
  it('seats each building at the lowest hill surface under its footprint, never above the hill', () => {
    for (const item of FAR_ITEMS) {
      expect(farSeatY(item), item.id).toBeLessThanOrEqual(farGroundY(item.x, item.z) + 1e-9);
      expect(farSeatY(item), item.id).toBeGreaterThan(2);
    }
  });
  it('is a crooked church: leaning, with a tower taller than the nave and a steeple on top', () => {
    expect(CHURCH.lean).toBeGreaterThan(0.03);
    expect(CHURCH.tower.h).toBeGreaterThan(CHURCH.nave.h + CHURCH.roofRise);
    expect(CHURCH.steeple.h).toBeGreaterThan(4);
  });
  it('uses the right models and stays inside a small share of the triangle budget', () => {
    expect(Object.keys(FAR_MODELS)).toEqual(['farm_barn', 'farm_windmill', 'castle_fortress', 'blood_ruins']);
    expect(farTriangles()).toBeLessThan(BUDGET.sceneTriangles * 0.2);
  });
  it('keeps every critter and detail inside the draw call and triangle limits', () => {
    const calls = Object.values(EXTRAS).reduce((n, e) => n + e.calls, 0);
    expect(calls).toBeLessThanOrEqual(34);
    expect(Object.values(EXTRAS).reduce((n, e) => n + e.tris, 0)).toBeLessThan(BUDGET.sceneTriangles * 0.25);
  });
});

describe('low clouds', () => {
  const puffs = lowCloudPuffs();
  it('come in three depths: farther clouds are higher and slower', () => {
    expect(new Set(puffs.map((p) => p.layer)).size).toBe(3);
    for (let i = 1; i < LOW_CLOUD_LAYERS.length; i++) {
      expect(LOW_CLOUD_LAYERS[i]!.z).toBeLessThan(LOW_CLOUD_LAYERS[i - 1]!.z);
      expect(LOW_CLOUD_LAYERS[i]!.speed).toBeLessThan(LOW_CLOUD_LAYERS[i - 1]!.speed);
      expect(LOW_CLOUD_LAYERS[i]!.y).toBeGreaterThan(LOW_CLOUD_LAYERS[i - 1]!.y);
    }
    // The two nearer layers pass in front of the far hills and the village; the farthest is a backdrop beyond them.
    const nearestHill = Math.max(...FAR_HILLS.map((h) => h.z));
    expect(LOW_CLOUD_LAYERS[0]!.z).toBeGreaterThan(nearestHill);
    expect(LOW_CLOUD_LAYERS[1]!.z).toBeGreaterThan(nearestHill);
  });
  it('drift slowly and wrap with a fade at both ends, so no wrap is seen', () => {
    for (const p of puffs.slice(0, 40)) {
      const x0 = lowCloudX(p, 0);
      const x1 = lowCloudX(p, 1 / 60);
      const d = Math.abs(x1 - x0);
      const wrapped = d > (p.xMax - p.xMin) - 0.1;
      expect(d < 0.02 || wrapped).toBe(true);
      if (wrapped) expect(lowCloudEdgeFade(x0, p.xMin, p.xMax)).toBeLessThan(0.02);
      expect(x0).toBeGreaterThanOrEqual(p.xMin);
      expect(x0).toBeLessThan(p.xMax);
    }
    expect(lowCloudEdgeFade(0, -50, 50)).toBeCloseTo(1, 6);
  });
  it('hide completely inside the moon keep-out angle and show fully beyond it, smoothly', () => {
    expect(lowCloudMoonVisibility(0)).toBe(0);
    expect(lowCloudMoonVisibility(MOON_KEEP_OUT_DEG)).toBe(0);
    expect(lowCloudMoonVisibility(MOON_KEEP_OUT_DEG + LOW_CLOUD_MOON_FADE_DEG)).toBe(1);
    let prev = 0;
    for (let a = 0; a < 40; a += 0.1) {
      const v = lowCloudMoonVisibility(a);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });
});

describe('windmill sails', () => {
  it('are split from the body: a plain test', () => {
    // Two triangles: one all in front, one not.
    const pos = [0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5, 0, 0, 0, 1, 0, 0, 0, 1, 0.5];
    const r = splitBlades(pos, null);
    expect(r.blades).toEqual([0, 1, 2]);
    expect(r.body).toEqual([3, 4, 5]);
    expect(hubOf(pos, r.blades)).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
  });
  it('are found in the real model: a flat plane in front, centred and round, with the body behind it', async () => {
    const gltf = await loadGlbGeometry('quaternius/farm_windmill.glb');
    gltf.scene.updateMatrixWorld(true);
    let mesh: Mesh | undefined;
    gltf.scene.traverse((o) => {
      if ((o as Mesh).isMesh) mesh = o as Mesh;
    });
    const pos = worldPositions(mesh!);
    const { blades, body } = splitBlades(pos, cornerIndices(mesh!.geometry));
    expect(blades.length / 3).toBeGreaterThan(150);
    expect(body.length / 3).toBeGreaterThan(300);
    const hub = hubOf(pos, blades);
    expect(Math.abs(hub.x)).toBeLessThan(0.05);
    expect(hub.y).toBeGreaterThan(0.6);
    expect(hub.y).toBeLessThan(0.95);
    // The sails fit in a circle around the hub, and the body stays behind them.
    let maxR = 0;
    for (const i of blades) maxR = Math.max(maxR, Math.hypot(pos[i * 3]! - hub.x, pos[i * 3 + 1]! - hub.y));
    expect(maxR).toBeLessThan(0.95);
    expect(maxR).toBeGreaterThan(0.55);
    const meanZ = (list: number[]) => list.reduce((n, i) => n + pos[i * 3 + 2]!, 0) / list.length;
    // The sails are in front of the body.
    expect(meanZ(blades)).toBeGreaterThan(meanZ(body) + 0.15);
  });
  it('the models used for the village exist and have the mesh names the scene asks for', async () => {
    const ruins = await loadGlbGeometry('quaternius/blood_ruins.glb');
    const names: string[] = [];
    ruins.scene.traverse((o) => {
      if ((o as Mesh).isMesh) names.push(o.name);
    });
    for (const part of FAR_MODELS.blood_ruins.parts) expect(names).toContain(part);
  });
});

describe('the built far village (real models)', () => {
  it('has hills, buildings and sails in the right places and sizes', async () => {
    const { buildFarVillage } = await import('../entrypoints/newtab/layers/scene/farBuild');
    const load = async (f: string) => (await loadGlbGeometry(`quaternius/${f}.glb`)).scene;
    const built = buildFarVillage({ barn: await load('farm_barn'), windmill: await load('farm_windmill'), fortress: await load('castle_fortress'), ruins: await load('blood_ruins') });
    const pos = built.village.getAttribute('position');
    expect(pos.count % 3).toBe(0);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      expect(Number.isFinite(x + y + z)).toBe(true);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    // Far behind the yard, on the hills, low enough to stay under the sky and wide enough to fill the horizon.
    expect(maxZ).toBeLessThan(-70);
    expect(minZ).toBeGreaterThan(-125);
    expect(minY).toBeGreaterThanOrEqual(-2.1); // the hills are half buried
    expect(maxY).toBeGreaterThan(14);
    expect(maxY).toBeLessThan(32);
    expect(maxX - minX).toBeGreaterThan(110);
    // The sails: a round plane about 0.8 wide (in model units; the windmill is drawn 4 times bigger), turning about its hub.
    expect(built.bladeGeo).not.toBeNull();
    const bp = built.bladeGeo!.getAttribute('position');
    let r = 0;
    for (let i = 0; i < bp.count; i++) r = Math.max(r, Math.hypot(bp.getX(i), bp.getY(i)));
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(1.0);
    expect(built.hubWorld.z).toBeLessThan(-90);
    expect(built.wins).toHaveLength(FAR_WINDOW_COUNT);
    // Nothing hovers: each building's base (from its bounding box after scaling) sits FAR_EMBED below the lowest hill surface under it.
    built.placed.forEach((item, i) => {
      expect(built.bases[i]!, item.id).toBeCloseTo(farSeatY(item) - FAR_EMBED, 6);
      expect(built.bases[i]!, item.id).toBeLessThan(farGroundY(item.x, item.z));
    });
    // Triangles: the models, the church, the houses and the hills together stay near the plan.
    expect(pos.count / 3).toBeLessThan(farTriangles() + 600);
    expect(pos.count / 3).toBeGreaterThan(12000);
  });
});

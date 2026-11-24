// Checks every Quaternius entry of MODELS against its real file (Req 9.8): hx, hz and h within 3 percent, tris exactly.
// The file is loaded with GLTFLoader and MeshoptDecoder (see tests/helpers/glb.ts).
import { describe, expect, it } from 'vitest';
import { Box3, Vector3, type Mesh } from 'three';
import { MODELS, type ModelId } from '../lib/scene/layout';
import { loadGlbGeometry } from './helpers/glb';

const ids = (Object.keys(MODELS) as ModelId[]).filter((id) => MODELS[id].source === 'quaternius');
/**
 * Crypt-era entries whose footprint was set larger than the file on purpose. Changing them would move the Crypt's
 * placements (tests/themeBaseline.test.ts), so only their triangles are checked.
 */
const PADDED_FOOTPRINT = new Set<ModelId>(['forest_twisted_c', 'forest_mushroom']);
const within = (value: number, expected: number) => Math.abs(value - expected) <= Math.abs(expected) * 0.03;

/** Measures the drawn meshes (only `parts` when the entry has them). `h` is the highest point, or the full height for `recentre` models. */
async function measure(id: ModelId) {
  const info = MODELS[id] as { parts?: readonly string[]; recentre?: true };
  const { scene } = await loadGlbGeometry(`quaternius/${id}.glb`);
  scene.updateMatrixWorld(true);
  const box = new Box3();
  let tris = 0;
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || (info.parts && !info.parts.includes(mesh.name))) return;
    box.expandByObject(mesh);
    const g = mesh.geometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  const size = box.getSize(new Vector3());
  return { hx: size.x / 2, hz: size.z / 2, h: info.recentre ? size.y : box.max.y, tris };
}

describe('Quaternius model sizes match the files', () => {
  it('covers the new theme models', () => {
    for (const id of ['farm_barn', 'forest_rocks', 'frost_pine_a', 'blood_ruins', 'castle_torch', 'castle_stone_wall'] as ModelId[]) {
      expect(ids).toContain(id);
    }
  });
  it.each(ids)('%s', async (id) => {
    const info = MODELS[id];
    const real = await measure(id);
    expect(info.tris, id).toBe(real.tris);
    if (PADDED_FOOTPRINT.has(id)) return;
    expect(within(real.hx, info.hx), `hx ${real.hx.toFixed(3)} vs ${info.hx}`).toBe(true);
    expect(within(real.hz, info.hz), `hz ${real.hz.toFixed(3)} vs ${info.hz}`).toBe(true);
    expect(within(real.h, info.h), `h ${real.h.toFixed(3)} vs ${info.h}`).toBe(true);
  });
});

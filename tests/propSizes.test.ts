// Every Quaternius prop is drawn at the size its catalogue entry gives, in every theme. This catches a model that
// renders at the wrong scale: `forest_mushroom_king` is a skinned mesh whose bones are scaled 100 times, and drawn
// without its skeleton it filled the whole Witch's Forest scene. Props are baked out of their skeleton
// (`bakeSkinned`) before they are drawn.
import { describe, expect, it } from 'vitest';
import { Box3, Matrix4, type Object3D, type SkinnedMesh } from 'three';
import { loadGlbGeometry } from './helpers/glb';
import { bakeSkinned, collectParts, compose } from '../entrypoints/newtab/layers/scene/ModelBatch';
import { MODELS, modelInfo, type ModelId, type Placement } from '../lib/scene/layout';
import { themeScene } from '../lib/scene/themeLayout';
import { THEME_IDS } from '../lib/themes';

const scenes = new Map<ModelId, Promise<Object3D>>();
const sceneOf = (id: ModelId) => {
  let s = scenes.get(id);
  if (!s) scenes.set(id, (s = loadGlbGeometry(`quaternius/${id}.glb`).then((g) => g.scene)));
  return s;
};

/** The world box of one placement, built the way `ModelBatch` builds its instances. */
async function worldBox(p: Placement): Promise<Box3> {
  const info = modelInfo(p.model);
  const parts = collectParts(await sceneOf(p.model), false, false, info.parts, info.recentre === true);
  const box = new Box3();
  for (const part of parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    box.union(part.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(compose(p, 1, new Matrix4()), part.local)));
  }
  return box;
}

describe('Quaternius props are drawn at their catalogue size', () => {
  it.each(THEME_IDS)('%s', async (theme) => {
    const placed = themeScene(theme).layout.placements.filter((p) => MODELS[p.model].source === 'quaternius');
    expect(placed.length).toBeGreaterThan(0);
    for (const p of placed) {
      const info = MODELS[p.model];
      const b = await worldBox(p);
      // Turning a prop can widen its box up to its diagonal; a small lean adds a little.
      const reach = 2 * Math.hypot(info.hx, info.hz) * p.scale * 1.15 + 0.1;
      expect(b.max.x - b.min.x, `${theme} ${p.id} width`).toBeLessThanOrEqual(reach);
      expect(b.max.z - b.min.z, `${theme} ${p.id} depth`).toBeLessThanOrEqual(reach);
      expect(b.max.y, `${theme} ${p.id} top`).toBeLessThanOrEqual(info.h * p.scale * 1.15 + 0.1);
    }
  }, 60_000);
});

describe('bakeSkinned', () => {
  it('gives forest_mushroom_king its real size, with no skin attributes, once per geometry', async () => {
    const root = await sceneOf('forest_mushroom_king');
    root.updateMatrixWorld(true);
    const skinned: SkinnedMesh[] = [];
    root.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
    });
    expect(skinned.length).toBeGreaterThan(0);
    const g = bakeSkinned(skinned[0]!);
    expect(bakeSkinned(skinned[0]!)).toBe(g);
    expect(g.getAttribute('skinIndex')).toBeUndefined();
    expect(g.getAttribute('skinWeight')).toBeUndefined();
    // The source geometry is left as the file has it, so drei's cache is untouched.
    expect(skinned[0]!.geometry.getAttribute('skinIndex')).toBeDefined();
    const info = modelInfo('forest_mushroom_king');
    const parts = collectParts(root, false, false, info.parts, info.recentre === true);
    const box = new Box3();
    for (const part of parts) box.union(part.geometry.boundingBox!.clone().applyMatrix4(part.local));
    expect(box.max.y).toBeGreaterThan(info.h * 0.85);
    expect(box.max.y).toBeLessThan(info.h * 1.15);
    expect(box.max.x - box.min.x).toBeLessThan(info.hx * 2 * 1.15);
  });
});

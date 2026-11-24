// Task 11.1: collectParts honours `recentre` and `parts`.
import { BoxGeometry, Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { collectParts } from '../entrypoints/newtab/layers/scene/Props';
import { MODELS } from '../lib/scene/layout';

function model() {
  const g = new Group();
  const a = new Mesh(new BoxGeometry(2, 4, 2), new MeshStandardMaterial());
  a.name = 'A';
  a.position.set(100, 10, -50);
  const b = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  b.name = 'B';
  b.position.set(200, 0, 0);
  g.add(a, b);
  return g;
}
const bounds = (parts: ReturnType<typeof collectParts>) => {
  const box = new Box3();
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    box.union(p.geometry.boundingBox!.clone().applyMatrix4(p.local));
  }
  return box;
};
describe('collectParts', () => {
  it('leaves the parts where the file has them without the flag', () => {
    const box = bounds(collectParts(model()));
    expect(box.min.y).toBe(-0.5);
    expect(box.max.x).toBe(200.5);
  });
  it('with recentre puts the footprint centre at x = 0, z = 0 and the lowest point at y = 0', () => {
    const box = bounds(collectParts(model(), false, false, undefined, true));
    expect(box.min.y).toBeCloseTo(0);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0);
  });
  it('recentres only the chosen parts', () => {
    const parts = collectParts(model(), false, false, ['A'], true);
    expect(parts).toHaveLength(1);
    const box = bounds(parts);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(4);
    expect(box.max.x).toBeCloseTo(1);
  });
  it('is set only on forest_rocks, blood_ruins, castle_torch and castle_wall_flag', () => {
    const set = (Object.keys(MODELS) as (keyof typeof MODELS)[]).filter((k) => (MODELS[k] as { recentre?: true }).recentre);
    expect(set.sort()).toEqual(['blood_ruins', 'castle_torch', 'castle_wall_flag', 'forest_rocks']);
  });
});

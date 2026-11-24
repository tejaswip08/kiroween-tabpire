import { BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { hubOf, splitBlades } from '../../../../../lib/scene/windmill';
import { cornerIndices, worldPositions } from '../geometryTools';

export interface WindmillParts {
  /** The tower, in the file's own space. */
  body: BufferGeometry;
  /** The four sails, centred on their hub, so they turn about the origin of their own group. */
  blades: BufferGeometry | null;
  /** Where the hub is, in the file's own space. */
  hub: { x: number; y: number; z: number };
  material: Material;
  /** Triangles of both parts together (the file's total). */
  tris: number;
}

/**
 * Splits the windmill file into its body and its sails (`lib/scene/windmill.ts` tells the two apart by position).
 * Both keep the file's normals and texture coordinates and its material, so the model looks as authored.
 */
export function buildWindmill(root: Object3D): WindmillParts | null {
  root.updateMatrixWorld(true);
  let mesh: Mesh | null = null;
  root.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh;
  });
  if (!mesh) return null;
  const m = mesh as Mesh;
  const positions = worldPositions(m);
  const corners = cornerIndices(m.geometry);
  const split = splitBlades(positions, corners);
  const base = m.geometry.clone().applyMatrix4(m.matrixWorld);
  const body = base.clone();
  body.setIndex(split.body);
  let blades: BufferGeometry | null = null;
  let hub = { x: 0, y: 0, z: 0 };
  if (split.blades.length > 0) {
    hub = hubOf(positions, split.blades);
    blades = base.clone();
    blades.setIndex(split.blades);
    blades.translate(-hub.x, -hub.y, -hub.z);
  }
  base.dispose();
  const material = Array.isArray(m.material) ? m.material[0]! : m.material;
  return { body, blades, hub, material, tris: (split.body.length + split.blades.length) / 3 };
}

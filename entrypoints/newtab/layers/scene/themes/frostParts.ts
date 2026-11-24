// Small helpers for the parts the Frozen Cemetery draws itself: instanced meshes made from a plan, and their materials.
import {
  BufferGeometry, Color, Euler, InstancedMesh, Material, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const s = new Vector3();
/** A matrix from a place, a turn about y, a size and an optional lean (about x and z). */
export function placeAt(x: number, y: number, z: number, rotY = 0, scale: number | readonly [number, number, number] = 1, tilt?: readonly [number, number], out = new Matrix4()): Matrix4 {
  e.set(tilt?.[0] ?? 0, rotY, tilt?.[1] ?? 0, 'YXZ');
  q.setFromEuler(e);
  if (typeof scale === 'number') s.set(scale, scale, scale);
  else s.set(scale[0], scale[1], scale[2]);
  return out.compose(v.set(x, y, z), q, s);
}
export interface InstanceOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
}
/** One instanced mesh (one draw call) with every matrix written once. */
export function makeInstanced(geometry: BufferGeometry, material: Material, matrices: readonly Matrix4[], name: string, opts: InstanceOptions = {}): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, matrices.length));
  mesh.count = matrices.length;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = opts.castShadow ?? false;
  mesh.receiveShadow = opts.receiveShadow ?? false;
  if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
  mesh.name = name;
  return mesh;
}
/** Flat-shaded lit material that reads the vertex colours of a merged shape. A little emissive keeps the dark stone from vanishing. */
export const litMaterial = (emissive = '#12294d', intensity = 0.45, roughness = 0.9): MeshStandardMaterial =>
  new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness, metalness: 0.05, emissive: new Color(emissive), emissiveIntensity: intensity });
/** An unlit, bright material (eyes, flames): the colour is above 1, so Bloom picks it up. */
export const glowMaterial = (color: string, level = 3): MeshBasicMaterial => new MeshBasicMaterial({ color: new Color(color).multiplyScalar(level), toneMapped: false, fog: false });
/** Disposes what a mesh owns. */
export function disposeMesh(m: InstancedMesh | { geometry: BufferGeometry; material: Material | Material[] }): void {
  m.geometry.dispose();
  for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  if ((m as InstancedMesh).isInstancedMesh) (m as InstancedMesh).dispose();
}
/** The slow pulse of light under the ice, 0 to 1, about one beat every 11 seconds. Held at 0.6 under reduced motion. */
export const icePulse = (time: number, reduced: boolean): number => (reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * 0.57));

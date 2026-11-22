import { BufferAttribute, BufferGeometry, type Matrix4, type Mesh, Vector3 } from 'three';

/** The mesh's corners as plain numbers in its parent's space (positions may be stored as normalised integers). */
export function worldPositions(mesh: Mesh, matrix?: Matrix4): Float32Array {
  const attr = mesh.geometry.getAttribute('position');
  const out = new Float32Array(attr.count * 3);
  const v = new Vector3();
  const m = matrix ?? mesh.matrixWorld;
  for (let i = 0; i < attr.count; i++) {
    v.fromBufferAttribute(attr, i).applyMatrix4(m);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

/** The mesh's triangle corner indices, one number per corner (made up if the mesh has no index). */
export function cornerIndices(geo: BufferGeometry): Uint32Array {
  if (geo.index) return Uint32Array.from(geo.index.array);
  return Uint32Array.from({ length: geo.getAttribute('position').count }, (_, i) => i);
}

/** A plain float geometry from chosen corners (three per triangle) of a position array, moved by `-shift`. Flat normals. */
export function geometryFromCorners(positions: Float32Array, corners: ArrayLike<number>, shift: Vector3 = new Vector3()): BufferGeometry {
  const out = new Float32Array(corners.length * 3);
  for (let k = 0; k < corners.length; k++) {
    const i = corners[k]!;
    out[k * 3] = positions[i * 3]! - shift.x;
    out[k * 3 + 1] = positions[i * 3 + 1]! - shift.y;
    out[k * 3 + 2] = positions[i * 3 + 2]! - shift.z;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  return g;
}

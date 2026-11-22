import {
  BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3,
} from 'three';

type Rgb = readonly [number, number, number];

/** One shape to put in a merged critter: its geometry, where it goes and a plain colour. */
export interface Piece {
  geo: BufferGeometry;
  matrix?: Matrix4;
  color: Rgb;
}

/**
 * Joins simple shapes into one geometry with a colour for each corner (and flat normals), so a critter is
 * drawn with one draw call. Colours above 1 are allowed (for glowing parts).
 */
export function mergePieces(pieces: Piece[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  for (const { geo, matrix, color } of pieces) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as BufferGeometry;
    if (matrix) g.applyMatrix4(matrix);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(color[0], color[1], color[2]);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  out.computeVertexNormals();
  return out;
}

const m4 = () => new Matrix4();
export const at = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): Matrix4 =>
  m4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz));

export const ball = (r: number, ws = 10, hs = 7) => new SphereGeometry(r, ws, hs);
export const cone = (r: number, h: number, seg = 5) => new ConeGeometry(r, h, seg);

/** A thin cylinder from point a to point b. */
export function stickBetween(a: readonly [number, number, number], b: readonly [number, number, number], r: number, seg = 6): BufferGeometry {
  const from = new Vector3(...a);
  const to = new Vector3(...b);
  const len = from.distanceTo(to);
  const g = new CylinderGeometry(r * 0.7, r, len, seg);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  g.applyMatrix4(m4().compose(from.clone().add(to).multiplyScalar(0.5), q, new Vector3(1, 1, 1)));
  return g;
}

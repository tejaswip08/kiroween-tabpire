// Splits the Quaternius windmill into its body and its four sails, so the sails can turn. Pure.
// The model is one mesh. Its sails are a flat plane at the front, in front of everything else on the
// body, so a triangle belongs to the sails when the middle of the triangle is in front of `FRONT_Z`.

/** The body reaches to z = 0.30 and the sails start at z = 0.36 (model space, after its node transform). */
export const FRONT_Z = 0.335;
/** The sails are a round plane around this point (model space). Front triangles outside this circle (the door, the steps and
 * the posts at the foot of the tower) belong to the body: if they turned with the sails they would fly around as loose debris. */
export const SAIL_CENTRE = { x: 0, y: 0.92 };
export const SAIL_RADIUS = 0.69;

export interface Split {
  /** Triangle corners (three indices per triangle). */
  blades: number[];
  body: number[];
}

export function splitBlades(positions: ArrayLike<number>, index: ArrayLike<number> | null, frontZ = FRONT_Z): Split {
  const count = index ? index.length : Math.floor(positions.length / 3);
  const at = (i: number) => (index ? index[i]! : i);
  const blades: number[] = [];
  const body: number[] = [];
  for (let t = 0; t + 2 < count; t += 3) {
    const a = at(t);
    const b = at(t + 1);
    const c = at(t + 2);
    const z = (positions[a * 3 + 2]! + positions[b * 3 + 2]! + positions[c * 3 + 2]!) / 3;
    const x = (positions[a * 3]! + positions[b * 3]! + positions[c * 3]!) / 3;
    const y = (positions[a * 3 + 1]! + positions[b * 3 + 1]! + positions[c * 3 + 1]!) / 3;
    const inFront = z > frontZ && y > 0.31 && Math.hypot(x - SAIL_CENTRE.x, y - SAIL_CENTRE.y) < SAIL_RADIUS;
    (inFront ? blades : body).push(a, b, c);
  }
  return { blades, body };
}

/** The middle of the sails (where they turn): the centre of the box around their corners. */
export function hubOf(positions: ArrayLike<number>, corners: number[]): { x: number; y: number; z: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const i of corners) {
    const x = positions[i * 3]!, y = positions[i * 3 + 1]!, z = positions[i * 3 + 2]!;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
}

/** How far the windmill body's lowest point is below y = 0 in the file (model space). A placement lifts the model by this times its scale. */
export const WINDMILL_FOOT = 0.0278;

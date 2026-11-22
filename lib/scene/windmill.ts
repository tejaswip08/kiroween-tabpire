// Splits the Quaternius windmill into its body and its four sails, so the sails can turn. Pure.
// The model is one mesh. Its sails are a flat plane at the front, in front of everything else on the
// body, so a triangle belongs to the sails when the middle of the triangle is in front of `FRONT_Z`.

/** The body reaches to z = 0.30 and the sails start at z = 0.36 (model space, after its node transform). */
export const FRONT_Z = 0.335;

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
    const inFront = (positions[a * 3 + 2]! + positions[b * 3 + 2]! + positions[c * 3 + 2]!) / 3 > frontZ;
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

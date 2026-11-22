import { BufferAttribute, BufferGeometry, ConeGeometry, InstancedBufferGeometry, SphereGeometry } from 'three';

/** One wing seen from above: x runs out along the span, z runs back along the chord. */
export const WING = {
  /** Leading edge: shoulder, elbow, wrist-and-tip. The wing bends at the elbow. */
  lead: [[0.1, 0.05], [0.55, 0.16], [1.05, -0.04]] as const,
  /** Trailing edge from the tip back to the body: pointed scallops with notches between them. */
  trail: [[1.05, -0.04], [0.92, -0.2], [0.82, -0.09], [0.68, -0.27], [0.55, -0.12], [0.4, -0.28], [0.27, -0.13], [0.14, -0.2], [0.1, -0.1]] as const,
  /** A point inside the wing the membrane fans out from. */
  hub: [0.5, -0.06] as const,
  span: 1.05,
} as const;

/**
 * A small 3D bat. +x is its right wing, +y is up and -z is forward. Each vertex has two numbers:
 * `aWing.x` is 0 for the body and ears, or -1 and 1 for the left and right wing; `aWing.y` is how far out
 * along the wing it is (0 at the body, 1 at the wing tip), which the shader uses to flap and fold the wing.
 * Normals are flat, so the moon can light each facet.
 */
export function makeBatGeometry(): BufferGeometry {
  const pos: number[] = [];
  const wing: number[] = [];
  const push = (x: number, y: number, z: number, side: number, s: number) => {
    pos.push(x, y, z);
    wing.push(side, s);
  };
  // Body: a small round egg-shaped body.
  const body = new SphereGeometry(0.14, 8, 6).toNonIndexed();
  const bp = body.getAttribute('position');
  for (let i = 0; i < bp.count; i++) push(bp.getX(i) * 0.95, bp.getY(i) * 0.9, bp.getZ(i) * 1.5, 0, 0);
  // Head, a little ahead of the body, and two tiny pointed ears.
  const head = new SphereGeometry(0.085, 7, 5).toNonIndexed();
  const hp = head.getAttribute('position');
  for (let i = 0; i < hp.count; i++) push(hp.getX(i), hp.getY(i) + 0.03, hp.getZ(i) - 0.24, 0, 0);
  for (const sx of [-1, 1]) {
    const ear = new ConeGeometry(0.035, 0.13, 4).toNonIndexed();
    const ep = ear.getAttribute('position');
    for (let i = 0; i < ep.count; i++) {
      // Lean each ear outward a little.
      push(sx * 0.055 + ep.getX(i) + sx * ep.getY(i) * 0.25, ep.getY(i) + 0.15, ep.getZ(i) - 0.26, 0, 0);
    }
  }
  // Wings: the outline fanned from the hub, one triangle per edge, both sides.
  const outline: (readonly [number, number])[] = [...WING.lead, ...WING.trail.slice(1)];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % outline.length]!;
      for (const [x, z] of [WING.hub, a, b] as const) push(side * x, 0, z, side, Math.min(1, x / WING.span));
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aWing', new BufferAttribute(new Float32Array(wing), 2));
  geo.computeVertexNormals();
  return geo;
}

/** The same geometry as an instanced geometry, ready for `count` bats. */
export function makeInstancedBat(count: number): InstancedBufferGeometry {
  const src = makeBatGeometry();
  const geo = new InstancedBufferGeometry();
  geo.index = src.index;
  for (const name of ['position', 'normal', 'aWing']) geo.setAttribute(name, src.getAttribute(name));
  geo.instanceCount = count;
  return geo;
}

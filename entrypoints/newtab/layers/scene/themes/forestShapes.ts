// The shapes the Witch's Forest builds itself: the face on the haunted tree, the flame, the scarecrow, the ghost, the graves,
// the grass and the ground. Each is one merged geometry (one draw call). No image files.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, LatheGeometry, PlaneGeometry, SphereGeometry, Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Grave } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { coloured } from './shapes';
/** A merged geometry, or an empty one when there is nothing to merge. */
const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts) ?? new BufferGeometry();
/** One flame: a thin cone of 6 sides, open at the base, standing on y = 0 and 1 high. Its colour comes from the shader. */
export function buildFlame(): BufferGeometry {
  return new ConeGeometry(1, 1, 6, 1, true).translate(0, 0.5, 0);
}
const WOOD = '#2a1c14';
const STRAW = '#cf9f3c';
/**
 * A scarecrow in a ragged dark coat and a pointed witch hat, arms out, standing on its post at y = 0 and facing +z. About 3.7
 * high and 3 across (the straw hands included). One merged geometry with flat colours.
 */
export function buildWitchScarecrow(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  parts.push(coloured(new CylinderGeometry(0.08, 0.11, 2.9, 6).translate(0, 1.45, 0), WOOD));
  parts.push(coloured(new BoxGeometry(2.3, 0.12, 0.12).translate(0, 2.05, 0), WOOD));
  // The coat: a cone-ish tube with a torn, uneven hem.
  const coat = new CylinderGeometry(0.34, 0.58, 1.25, 8, 1, true).translate(0, 1.55, 0);
  const cp = coat.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) < 1.0) cp.setY(i, cp.getY(i) + (i % 2 === 0 ? -0.2 : 0.1));
  }
  parts.push(coloured(coat, '#1b1311'));
  parts.push(coloured(new CylinderGeometry(0.34, 0.34, 0.05, 8).translate(0, 2.17, 0), '#1b1311'));
  // Sleeves along the arms, with torn strips hanging from them.
  for (const side of [-1, 1]) {
    parts.push(coloured(new CylinderGeometry(0.15, 0.2, 0.95, 6).rotateZ(Math.PI / 2).translate(side * 0.62, 2.05, 0), '#1b1311'));
    for (const [x, len] of [[0.35, 0.4], [0.62, 0.5], [0.9, 0.34]] as const) {
      parts.push(coloured(new ConeGeometry(0.09, len, 4).rotateX(Math.PI).translate(side * x, 2.05 - len / 2 - 0.1, 0.02), '#241a16'));
    }
    // Straw hands: a fan of thin spikes at the end of each arm.
    for (let k = -2; k <= 2; k++) {
      parts.push(coloured(new ConeGeometry(0.045, 0.5, 4).rotateZ(-side * (Math.PI / 2 + k * 0.28)).translate(side * 1.3, 2.05 - k * 0.02, 0), STRAW));
    }
  }
  // Straw sticking out of the neck, the head and the hat.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parts.push(coloured(new ConeGeometry(0.04, 0.35, 4).rotateX(-0.7).rotateY(a).translate(Math.sin(a) * 0.12, 2.28, Math.cos(a) * 0.12), STRAW));
  }
  parts.push(coloured(new SphereGeometry(0.3, 8, 6).translate(0, 2.5, 0), '#6a5136'));
  for (const side of [-1, 1]) parts.push(coloured(new SphereGeometry(0.05, 5, 4).translate(side * 0.11, 2.54, 0.27), '#0a0605'));
  parts.push(coloured(new BoxGeometry(0.22, 0.04, 0.04).translate(0, 2.4, 0.29), '#0a0605'));
  // The hat: a wide brim and a tall, bent point.
  parts.push(coloured(new CylinderGeometry(0.58, 0.58, 0.05, 10).translate(0, 2.72, 0), '#120d12'));
  const crown = new ConeGeometry(0.34, 1.0, 8).translate(0, 3.25, 0);
  const hp = crown.getAttribute('position');
  for (let i = 0; i < hp.count; i++) {
    const k = Math.max(0, (hp.getY(i) - 2.75) / 1.0);
    hp.setX(i, hp.getX(i) + 0.22 * k * k);
  }
  parts.push(coloured(crown, '#171017'));
  parts.push(coloured(new CylinderGeometry(0.345, 0.37, 0.1, 8).translate(0, 2.82, 0), '#4a2a12'));
  return merge(parts);
}
/** The shape of a ghost's body: a rounded top, straight sides and a wavy hem. 1.3 high, about 0.9 across, standing on y = 0, facing +z. */
export function buildGhost(): BufferGeometry {
  const profile = [
    new Vector2(0, 0.02), new Vector2(0.32, 0), new Vector2(0.5, 0.05), new Vector2(0.5, 0.55), new Vector2(0.45, 0.9), new Vector2(0.34, 1.15),
    new Vector2(0.18, 1.28), new Vector2(0, 1.32),
  ];
  const body = new LatheGeometry(profile, 14);
  const pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.1) continue;
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    pos.setY(i, y + Math.max(0, Math.hypot(pos.getX(i), pos.getZ(i)) - 0.1) * 0.5 * Math.sin(a * 4));
  }
  const parts = [coloured(body, '#ffffff')];
  for (const side of [-1, 1]) parts.push(coloured(new SphereGeometry(0.095, 6, 5).scale(1, 1.45, 0.5).translate(side * 0.17, 0.85, 0.44), '#04100a'));
  parts.push(coloured(new SphereGeometry(0.09, 6, 5).scale(1, 1.3, 0.5).translate(0, 0.55, 0.47), '#04100a'));
  return merge(parts);
}
/** All the graves as one geometry: a crooked wooden cross or a tiny round-topped tombstone each, leaning and turned, sunk a little in the ground. */
export function buildGraves(graves: readonly Grave[]): BufferGeometry {
  const parts = graves.map((g) => {
    const items: BufferGeometry[] =
      g.kind === 'cross'
        ? [
            coloured(new BoxGeometry(0.12, 1.1, 0.1).translate(0, 0.55, 0), '#3b2717'),
            coloured(new BoxGeometry(0.62, 0.12, 0.1).rotateZ(0.08).translate(0, 0.78, 0), '#3b2717'),
          ]
        : [
            coloured(new BoxGeometry(0.6, 0.62, 0.16).translate(0, 0.31, 0), '#4a4a52'),
            coloured(new CylinderGeometry(0.3, 0.3, 0.16, 8).rotateX(Math.PI / 2).translate(0, 0.62, 0), '#4a4a52'),
          ];
    const one = merge(items);
    one.rotateZ(g.tilt);
    one.rotateY(g.rotY);
    one.scale(g.scale, g.scale, g.scale);
    one.translate(g.x, -0.08, g.z);
    return one;
  });
  return merge(parts);
}
/** One tuft of rough grass: three thin blades leaning out, dark at the root and a little lighter at the tip. Stands on y = 0, 1 high, 0.5 across. */
export function buildTuft(): BufferGeometry {
  const blades = [0, 1, 2].map((k) => {
    const g = new ConeGeometry(0.06, 1, 3, 1, true).translate(0, 0.5, 0).rotateZ(0.28).rotateY(k * 2.1);
    return withGradient(g, '#071208', '#2c4a22', 0, 1);
  });
  return merge(blades);
}
/** One small dark plant: five leaves splayed from the middle. Stands on y = 0, about 1 high and 1 across. */
export function buildPlant(): BufferGeometry {
  const leaves = [0, 1, 2, 3, 4].map((k) => {
    const g = new ConeGeometry(0.13, 1, 4, 1, true).translate(0, 0.5, 0).scale(1, 1, 0.35).rotateZ(0.65).rotateY(k * 1.26);
    return withGradient(g, '#08140c', '#1d3d2a', 0, 0.8);
  });
  return merge(leaves);
}
/** Vertex colours that blend from `low` at height `y0` to `high` at height `y1`. */
function withGradient(g: BufferGeometry, low: string, high: string, y0: number, y1: number): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  const a = new Color(low);
  const b = new Color(high);
  const pos = out.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, Math.max(0, Math.min(1, (pos.getY(i) - y0) / (y1 - y0))));
    col.set([c.r, c.g, c.b], i * 3);
  }
  out.setAttribute('color', new BufferAttribute(col, 3));
  return out;
}
/** Cells along each side of the ground plane. */
export const GROUND_CELLS = 36;
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/**
 * The ground: a near-black plane whose vertex colours carry the two tones of the forest. It is warm red-brown on the left,
 * around the fire, and a cold green toward the right and the distance. 200 across, lying on y = 0 with its centre at (0, 0, -40).
 */
export function buildForestGround(fire: { x: number; z: number }): BufferGeometry {
  const g = new PlaneGeometry(200, 200, GROUND_CELLS, GROUND_CELLS);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const base = new Color('#0b0908');
  const warm = new Color('#3a140a');
  const green = new Color('#0c2a1a');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - 40;
    const nearFire = Math.exp(-((x - fire.x) ** 2 + (z - fire.z) ** 2) / 90);
    const left = 1 - smooth(-14, 6, x);
    const right = smooth(-2, 14, x);
    const far = smooth(-6, -34, z);
    c.copy(base).lerp(warm, Math.min(1, nearFire * 0.8 + left * 0.18 * (1 - far)));
    c.lerp(green, Math.min(1, right * 0.6 + far * 0.55));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

type V3 = [number, number, number];
/**
 * A tapered tube along a line of points: `sides` sides, a radius for each point, one flat colour, open at both ends (the ends
 * are thin). Indexed, with normals, so tubes merge with each other.
 */
function tube(points: readonly V3[], radii: readonly number[], color: string, sides = 5): BufferGeometry {
  const c = new Color(color);
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(points.length - 1, i + 1)]!;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    let tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // A vector across the tube: the tangent crossed with the up axis, or the x axis when the tube runs straight up.
    let nx = -tz;
    let ny = 0;
    let nz = tx;
    if (Math.hypot(nx, nz) < 0.2) {
      nx = 1;
      nz = 0;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    for (let k = 0; k < sides; k++) {
      const th = (k / sides) * Math.PI * 2;
      const r = radii[i]!;
      pos.push(p[0] + (Math.cos(th) * nx + Math.sin(th) * bx) * r, p[1] + (Math.cos(th) * ny + Math.sin(th) * by) * r, p[2] + (Math.cos(th) * nz + Math.sin(th) * bz) * r);
      col.push(c.r, c.g, c.b);
    }
    if (i < points.length - 1) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const q = i * sides;
        index.push(q + k, q + sides + k, q + k2, q + k2, q + sides + k, q + sides + k2);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
const BARK = '#2b1f1b';
const BARK_LIGHT = '#3b2b25';
/**
 * A scary dead tree, about 5 to 7 high and 5 across, standing on y = 0: a twisted trunk on gripping roots, long crooked limbs
 * that reach out and up, each ending in three thin claw fingers that curl down, and two bent spikes on top. The three variants
 * differ in lean, height and number of limbs. One merged geometry of flat-coloured tubes, under 900 triangles.
 */
export function buildScaryTree(variant: number): BufferGeometry {
  const rng = mulberry32(100 + variant * 37);
  const between = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const height = 4.6 + variant * 0.8;
  const lean = (variant - 1) * 0.5;
  const parts: BufferGeometry[] = [];
  const trunk: V3[] = [];
  const tr: number[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    trunk.push([Math.sin(t * 3.1 + variant) * 0.35 * t + lean * t * t, height * t, Math.cos(t * 2.4 + variant * 2) * 0.3 * t]);
    tr.push(0.55 * (1 - t) ** 0.9 + 0.07);
  }
  parts.push(tube(trunk, tr, BARK, 6));
  // Roots gripping the ground.
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6 + between(0, 0.8);
    const len = between(0.9, 1.5);
    parts.push(tube([[Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2], [Math.cos(a) * len * 0.6, 0.28, Math.sin(a) * len * 0.6], [Math.cos(a) * len, 0.02, Math.sin(a) * len]], [0.26, 0.15, 0.04], BARK, 4));
  }
  // Long crooked limbs, with claw fingers at the ends.
  const limbs = 5 + variant;
  for (let k = 0; k < limbs; k++) {
    const t = 0.35 + (k / limbs) * 0.6;
    const base = trunk[Math.min(steps, Math.round(t * steps))]!;
    const a = k * 2.4 + between(0, 0.6);
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const len = between(1.4, 2.4) * (1.1 - t * 0.4);
    const rise = between(-0.2, 0.9);
    const p1: V3 = [base[0] + dx * len * 0.35, base[1] + 0.3 + rise * 0.3, base[2] + dz * len * 0.35];
    const p2: V3 = [base[0] + dx * len * 0.7 - dz * 0.25, base[1] + 0.35 + rise * 0.8, base[2] + dz * len * 0.7 + dx * 0.25];
    const p3: V3 = [base[0] + dx * len, base[1] + 0.2 + rise * 0.6, base[2] + dz * len];
    parts.push(tube([base, p1, p2, p3], [0.17 * (1 - t * 0.5), 0.12, 0.07, 0.035], BARK, 5));
    for (let f = -1; f <= 1; f++) {
      const fa = a + f * 0.55;
      const fx = Math.cos(fa);
      const fz = Math.sin(fa);
      parts.push(tube([p3, [p3[0] + fx * 0.3, p3[1] + 0.1, p3[2] + fz * 0.3], [p3[0] + fx * 0.55, p3[1] - 0.12, p3[2] + fz * 0.55]], [0.035, 0.022, 0.006], BARK_LIGHT, 3));
    }
  }
  // Two bent spikes on top.
  const top = trunk[steps]!;
  for (const s of [-1, 1]) parts.push(tube([top, [top[0] + s * 0.25, top[1] + 0.5, top[2]], [top[0] + s * 0.55, top[1] + 0.85, top[2] + 0.1 * s]], [0.07, 0.045, 0.006], BARK_LIGHT, 4));
  return merge(parts);
}
/** A thorn bush: nine curved spikes fanning up and out from the middle, dark at the root. 1 high and 1 across, standing on y = 0. */
export function buildThornBush(): BufferGeometry {
  const spikes = Array.from({ length: 9 }, (_, k) => {
    const g = new ConeGeometry(0.07, 1, 3, 1, true).translate(0, 0.5, 0).scale(1, 0.6 + (k % 3) * 0.2, 1).rotateZ(0.35 + (k % 4) * 0.18).rotateY(k * 0.7);
    return withGradient(g, '#0b0907', '#2a1f22', 0, 1);
  });
  return merge(spikes);
}
/** A fallen dead log with two broken stubs, lying along x on y = 0, about 3.2 long. */
export function buildFallenLog(): BufferGeometry {
  const body = tube([[-1.6, 0.25, 0], [-0.5, 0.3, 0.08], [0.6, 0.3, -0.05], [1.6, 0.2, 0]], [0.12, 0.3, 0.3, 0.14], BARK, 6);
  const stubA = tube([[-0.2, 0.45, 0], [-0.25, 0.9, 0.1], [-0.1, 1.25, 0.2]], [0.1, 0.06, 0.012], BARK_LIGHT, 4);
  const stubB = tube([[0.7, 0.4, 0], [0.8, 0.7, -0.15], [0.7, 0.95, -0.35]], [0.08, 0.05, 0.01], BARK_LIGHT, 4);
  return merge([body, stubA, stubB]);
}

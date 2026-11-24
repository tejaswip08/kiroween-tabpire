// The shapes of the Pumpkin Patch's autumn lane, built from simple three shapes with vertex colours. No image files.
// Every builder returns one merged geometry (position, normal, colour), so each thing is one draw call.
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, Matrix4, Quaternion, Shape, ShapeGeometry,
  SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../../../../lib/scene/rng';
import {
  BANK, bankHeight, curvePoint, radiusAt, sideOf,
  type FencePost, type LeafCluster, type LeafTone, type TrackPoint, type TreePlan, type Tube, type V3,
} from '../../../../../lib/scene/uniqueScenes/autumn';

/** A non-indexed copy with position, normal and a flat colour, so shapes can be merged. */
export function paint(g: BufferGeometry, color: string | Color): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  out.deleteAttribute('uv');
  const c = new Color(color);
  const n = out.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new BufferAttribute(arr, 3));
  return out;
}
const merge = (parts: BufferGeometry[]): BufferGeometry => mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!;
export const trianglesOf = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

// ---------- the tree ----------

const BARK = { dark: new Color('#2e1a0e'), mid: new Color('#4a2d1a'), light: new Color('#6a4426') };
const LEAF_COLOR: Record<LeafTone, string> = { red: '#d6301b', orange: '#f0802a', gold: '#f7b733', deep: '#a8201a' };

/** A tapered tube along a curve: rings of `sides` points, carried along the curve without twisting. Smooth normals. */
export function buildTube(tube: Tube, sides: number, segs: number, twisted: boolean): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const T = new Vector3();
  const N = new Vector3();
  const Bn = new Vector3();
  const prev = new Vector3();
  const next = new Vector3();
  const c = new Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curvePoint(tube.points, t);
    const a = curvePoint(tube.points, Math.max(0, t - 0.02));
    const b = curvePoint(tube.points, Math.min(1, t + 0.02));
    prev.set(...a);
    next.set(...b);
    T.subVectors(next, prev).normalize();
    if (i === 0) N.crossVectors(Math.abs(T.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1), T).normalize();
    else N.addScaledVector(T, -N.dot(T)).normalize();
    Bn.crossVectors(T, N).normalize();
    const r0 = radiusAt(tube, t);
    for (let s = 0; s < sides; s++) {
      const ang = (s / sides) * Math.PI * 2;
      // The trunk: ridged bark that twists as it climbs, and roots that flare at the foot.
      const ridge = twisted ? Math.sin(3 * ang + p[1] * 0.9) * 0.1 + Math.sin(5 * ang - p[1] * 0.5) * 0.04 : 0;
      const root = twisted ? Math.max(0, 1 - (p[1] + 0.4) / 1.8) ** 2 * (0.5 + 0.4 * Math.max(0, Math.sin(3 * ang + 0.7))) : 0;
      const r = r0 * (1 + ridge + root);
      pos.push(p[0] + (N.x * Math.cos(ang) + Bn.x * Math.sin(ang)) * r, p[1] + (N.y * Math.cos(ang) + Bn.y * Math.sin(ang)) * r, p[2] + (N.z * Math.cos(ang) + Bn.z * Math.sin(ang)) * r);
      const k = twisted ? 0.5 + 0.5 * Math.sin(3 * ang + p[1] * 0.9) : 0.5 + 0.5 * Math.sin(ang * 2 + t * 5);
      c.copy(BARK.dark).lerp(BARK.mid, Math.min(1, k * 1.4)).lerp(BARK.light, Math.max(0, k - 0.6) * 0.8 + t * 0.12);
      col.push(c.r, c.g, c.b);
    }
    if (i > 0) {
      for (let s = 0; s < sides; s++) {
        const s2 = (s + 1) % sides;
        const a0 = (i - 1) * sides + s;
        const a1 = (i - 1) * sides + s2;
        const b0 = i * sides + s;
        const b1 = i * sides + s2;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The knot hole: a dark hollow with a lighter, rough rim around it, on the camera side of the trunk. */
function buildKnot(knot: TreePlan['knot']): BufferGeometry[] {
  const place = (g: BufferGeometry, w: number, h: number, depth: number, back: number) => {
    g.scale(w, h, depth);
    g.rotateY(knot.rotY);
    g.translate(knot.x - Math.sin(knot.rotY) * back, knot.y, knot.z - Math.cos(knot.rotY) * back);
    return g;
  };
  return [
    paint(place(new SphereGeometry(1, 8, 6), knot.w * 1.35, knot.h * 1.28, 0.12, 0.06), '#6a4526'),
    paint(place(new SphereGeometry(1, 8, 6), knot.w, knot.h, 0.14, 0), '#0e0603'),
  ];
}

/** The trunk, the limbs, the twigs and the knot hole: one geometry. */
export function buildTreeWood(plan: TreePlan): BufferGeometry {
  const parts: BufferGeometry[] = [buildTube(plan.trunk, 12, 14, true)];
  for (const b of plan.branches) {
    const thick = b.radii[0]! > 0.2;
    parts.push(buildTube(b, thick ? 8 : 5, thick ? 10 : 4, false));
  }
  parts.push(...buildKnot(plan.knot));
  return merge(parts);
}

/** All the leaf clusters: two overlapping low-poly blobs each, a little darker underneath. One geometry, flat shading. */
export function buildTreeLeaves(clusters: readonly LeafCluster[], seed = 5): BufferGeometry {
  const rng = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const base = new Color();
  const c = new Color();
  const q = new Quaternion();
  const m = new Matrix4();
  for (const cl of clusters) {
    for (let k = 0; k < 2; k++) {
      const g = new IcosahedronGeometry(1, 0).toNonIndexed();
      q.setFromEuler(new Euler(rng() * 3, cl.rotY + k * 1.1, rng() * 3));
      const s = cl.r * (k === 0 ? 1 : 0.78);
      m.compose(new Vector3(cl.x + (k ? (rng() - 0.5) * cl.r * 0.8 : 0), cl.y + (k ? cl.r * 0.25 : 0), cl.z + (k ? (rng() - 0.5) * cl.r * 0.8 : 0)), q, new Vector3(s * (0.9 + rng() * 0.25), s * (0.72 + rng() * 0.2), s * (0.9 + rng() * 0.25)));
      g.applyMatrix4(m);
      g.deleteAttribute('uv');
      base.set(LEAF_COLOR[k === 0 ? cl.tone : rng() < 0.5 ? cl.tone : 'orange']);
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      const nrm = g.getAttribute('normal');
      for (let i = 0; i < n; i += 3) {
        // A little lighter on faces that look up, darker underneath, and some noise face by face.
        const up = nrm.getY(i);
        const f = 0.78 + 0.3 * (up * 0.5 + 0.5) + (rng() - 0.5) * 0.18;
        c.copy(base).multiplyScalar(f);
        for (let v = 0; v < 3; v++) arr.set([c.r, c.g, c.b], (i + v) * 3);
      }
      g.setAttribute('color', new BufferAttribute(arr, 3));
      parts.push(g);
    }
  }
  return merge(parts);
}

// ---------- the trick-or-treaters ----------

const at = <T extends BufferGeometry>(g: T, x: number, y: number, z: number): T => g.translate(x, y, z);
function bucket(x: number, y: number, z: number): BufferGeometry[] {
  return [
    paint(at(new SphereGeometry(0.1, 8, 6).scale(1, 0.85, 1), x, y, z), '#f08a1c'),
    paint(at(new CylinderGeometry(0.014, 0.02, 0.05, 4), x, y + 0.09, z), '#3d6a2a'),
    paint(at(new CylinderGeometry(0.008, 0.008, 0.2, 3).rotateZ(Math.PI / 2), x, y + 0.1, z), '#2a1a12'),
  ];
}
/** A little witch: a dark dress, striped legs, hair seen from behind and a tall pointed hat. About 1.65 units tall. */
export function buildWitchKid(): BufferGeometry {
  return merge([
    paint(at(new CylinderGeometry(0.13, 0.3, 0.62, 10), 0, 0.5, 0), '#2b1a46'),
    paint(at(new CylinderGeometry(0.31, 0.3, 0.04, 10), 0, 0.2, 0), '#4a2d70'),
    paint(at(new CylinderGeometry(0.035, 0.035, 0.22, 5), -0.08, 0.1, 0), '#e9852a'),
    paint(at(new CylinderGeometry(0.035, 0.035, 0.22, 5), 0.08, 0.1, 0), '#1c1224'),
    paint(at(new BoxGeometry(0.1, 0.06, 0.16), -0.08, 0.03, -0.04), '#1a1018'),
    paint(at(new BoxGeometry(0.1, 0.06, 0.16), 0.08, 0.03, -0.04), '#1a1018'),
    paint(at(new SphereGeometry(0.15, 9, 7).scale(1, 0.95, 1), 0, 0.95, 0.02), '#5a3420'),
    paint(at(new SphereGeometry(0.06, 6, 5), -0.17, 0.82, 0.05), '#5a3420'),
    paint(at(new SphereGeometry(0.06, 6, 5), 0.17, 0.82, 0.05), '#5a3420'),
    paint(at(new CylinderGeometry(0.04, 0.045, 0.34, 6).rotateZ(-0.45), -0.22, 0.62, 0), '#2b1a46'),
    paint(at(new CylinderGeometry(0.33, 0.33, 0.035, 12), 0, 1.07, 0), '#1d1230'),
    paint(at(new CylinderGeometry(0.17, 0.2, 0.09, 10), 0, 1.13, 0), '#e07a1c'),
    paint(at(new ConeGeometry(0.19, 0.5, 10), 0, 1.4, 0), '#2a1a46'),
    ...bucket(-0.38, 0.4, -0.02),
  ]);
}

// ---------- corn ----------

/**
 * A low-poly green field corn stalk, about 2.3 units tall at scale 1, for filling the fields cheaply: a stem, four broad
 * blades, a yellow ear and a tassel. 25 triangles.
 */
export function buildFieldStalk(): BufferGeometry {
  const parts: BufferGeometry[] = [paint(at(new CylinderGeometry(0.03, 0.055, 2.2, 4, 1, true), 0, 1.1, 0), '#5f7f34')];
  const tones = ['#6f9a3a', '#5a8430', '#86a845', '#4f7a2c'];
  for (let i = 0; i < 4; i++) {
    const ang = i * 1.75 + 0.4;
    const h = 0.55 + i * 0.38;
    const len = 0.75 - i * 0.08;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz * 0.08;
    const pz = dx * 0.08;
    const arr = new Float32Array([
      dx * 0.03 - px, h, dz * 0.03 - pz, dx * 0.03 + px, h, dz * 0.03 + pz, dx * len * 0.55, h + len * 0.3, dz * len * 0.55,
      dx * 0.03 + px, h, dz * 0.03 + pz, dx * len, h - len * 0.1, dz * len, dx * len * 0.55, h + len * 0.3, dz * len * 0.55,
    ]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(arr, 3));
    g.computeVertexNormals();
    parts.push(paint(g, tones[i]!));
  }
  parts.push(paint(at(new ConeGeometry(0.07, 0.34, 3).rotateZ(-0.45), 0.12, 1.35, 0), '#e8c24a'));
  parts.push(paint(at(new ConeGeometry(0.05, 0.36, 3), 0, 2.36, 0), '#c9a24a'));
  return merge(parts);
}

// ---------- dry corn ----------

/** One dry corn stalk, about 2.6 units tall at scale 1: tan stem, drooping blades, a husked ear and a dry tassel. */
export function buildDryStalk(): BufferGeometry {
  const rng = mulberry32(77);
  const parts: BufferGeometry[] = [paint(at(new CylinderGeometry(0.03, 0.06, 2.6, 5), 0, 1.3, 0), '#b8995a')];
  const blade = (h: number, ang: number, len: number, tone: string) => {
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz * 0.07;
    const pz = dx * 0.07;
    const p0 = [dx * 0.04, h, dz * 0.04];
    const p1 = [dx * len * 0.5, h + len * 0.2, dz * len * 0.5];
    const p2 = [dx * len, h - len * 0.18, dz * len];
    const tri = (a: number[], b: number[], c: number[]) => [...a, ...b, ...c];
    const arr = new Float32Array([
      ...tri([p0[0]! - px, p0[1]!, p0[2]! - pz], [p0[0]! + px, p0[1]!, p0[2]! + pz], [p1[0]! - px * 0.7, p1[1]!, p1[2]! - pz * 0.7]),
      ...tri([p0[0]! + px, p0[1]!, p0[2]! + pz], [p1[0]! + px * 0.7, p1[1]!, p1[2]! + pz * 0.7], [p1[0]! - px * 0.7, p1[1]!, p1[2]! - pz * 0.7]),
      ...tri([p1[0]! - px * 0.7, p1[1]!, p1[2]! - pz * 0.7], [p1[0]! + px * 0.7, p1[1]!, p1[2]! + pz * 0.7], p2 as number[]),
    ]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return paint(g, tone);
  };
  const tones = ['#c8a965', '#b08d4e', '#d6bd7c', '#9c7c44'];
  for (let i = 0; i < 7; i++) parts.push(blade(0.45 + i * 0.27, i * 2.4 + rng(), 0.85 + rng() * 0.45, tones[i % tones.length]!));
  parts.push(paint(at(new ConeGeometry(0.09, 0.42, 5).rotateZ(-0.5), 0.16, 1.5, 0.02), '#a98a4c'));
  parts.push(paint(at(new ConeGeometry(0.05, 0.14, 5).rotateZ(-0.5), 0.3, 1.66, 0.02), '#e0b84a'));
  for (let i = 0; i < 3; i++) parts.push(paint(at(new ConeGeometry(0.025, 0.5, 3).rotateZ((i - 1) * 0.5), (i - 1) * 0.1, 2.75, 0), '#8c6b3a'));
  return merge(parts);
}

// ---------- the crooked fence ----------

const WOOD = ['#6b4a2b', '#5a3d24', '#7b5a35', '#4f3620'];
/** The posts and rails of one side of the trail. Posts lean, rails run from post to post at their own heights, some bays are broken. */
export function buildFence(sides: readonly (readonly FencePost[])[], seed = 3): BufferGeometry {
  const rng = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const point = (p: FencePost, frac: number): Vector3 =>
    new Vector3(0, p.height * frac, 0).applyEuler(new Euler(p.leanX, 0, p.leanZ)).add(new Vector3(p.x, p.y, p.z));
  for (const posts of sides) {
    posts.forEach((p, i) => {
      const post = new BoxGeometry(0.14, p.height, 0.12).translate(0, p.height / 2, 0).applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(p.leanX, rng() * 0.6, p.leanZ)).setPosition(p.x, p.y, p.z));
      parts.push(paint(post, WOOD[Math.floor(rng() * WOOD.length)]!));
      const top = point(p, 1);
      parts.push(paint(new ConeGeometry(0.1, 0.1, 4).rotateY(Math.PI / 4).translate(top.x, top.y + 0.04, top.z), WOOD[Math.floor(rng() * WOOD.length)]!));
      const next = posts[i + 1];
      if (!next) return;
      [0.42, 0.78].forEach((frac, ri) => {
        // A broken bay keeps only its lower rail, and that one hangs down at the far end.
        if (p.gap && ri === 1) return;
        const a = point(p, frac + (rng() - 0.5) * 0.08);
        const b = point(next, frac + (rng() - 0.5) * 0.08);
        if (p.gap) b.y -= 0.28;
        const dir = new Vector3().subVectors(b, a);
        const len = dir.length();
        const rail = new BoxGeometry(len, 0.08, 0.06);
        const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir.clone().normalize());
        const roll = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (rng() - 0.5) * 0.3);
        rail.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q.multiply(roll), new Vector3(1, 1, 1)));
        parts.push(paint(rail, WOOD[Math.floor(rng() * WOOD.length)]!));
      });
    });
  }
  return merge(parts);
}

// ---------- grass ----------

const BANK_OFFSETS = [BANK.inner - 0.05, 1.7, 2.4, 3.2, 4.2, 5.4, BANK.outer];
const BANK_COLORS = ['#a6a23c', '#bcbc48', '#a8c04a', '#90b240', '#78a038', '#628a30', '#527a2c'];
/** Soft grass banks along both sides of the trail: a ribbon of rows across the mound, golden near the trail and greener outward. */
export function buildBanks(line: readonly TrackPoint[], seed = 11): BufferGeometry {
  const rng = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const c = new Color();
  for (const side of [-1, 1]) {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    line.forEach((p, i) => {
      const shade = 0.92 + rng() * 0.16;
      BANK_OFFSETS.forEach((off, k) => {
        const q = sideOf(p, side, off);
        const bump = k > 0 && k < BANK_OFFSETS.length - 1 ? Math.sin(i * 1.3 + k * 2.1 + side) * 0.035 : 0;
        pos.push(q.x, Math.max(0.004, bankHeight(off) + bump), q.z);
        c.set(BANK_COLORS[k]!).multiplyScalar(shade);
        col.push(c.r, c.g, c.b);
      });
      if (i > 0) {
        const w = BANK_OFFSETS.length;
        for (let k = 0; k < w - 1; k++) {
          const a0 = (i - 1) * w + k;
          const b0 = i * w + k;
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    g.setIndex(side > 0 ? idx : idx.map((v, i, a) => (i % 3 === 1 ? a[i + 1]! : i % 3 === 2 ? a[i - 1]! : v)));
    g.computeVertexNormals();
    // Every normal leans up, whichever way the rows were wound.
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    parts.push(g);
  }
  return merge(parts);
}

/** One tuft of grass: seven thin blades fanning out, dark at the foot and light at the tip. About 0.4 tall. */
export function buildTuft(): BufferGeometry {
  const rng = mulberry32(19);
  const pos: number[] = [];
  const col: number[] = [];
  const foot = new Color('#5a8a2c');
  const tip = new Color('#d4dc60');
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + rng() * 0.5;
    const lean = 0.08 + rng() * 0.2;
    const h = 0.28 + rng() * 0.2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz * 0.028;
    const pz = dx * 0.028;
    const bx = dx * 0.03;
    const bz = dz * 0.03;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + dx * lean, h, bz + dz * lean);
    col.push(foot.r, foot.g, foot.b, foot.r, foot.g, foot.b, tip.r, tip.g, tip.b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  // Blades are lit from above, whichever side faces the light.
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

/** A leaf lying flat on the ground (x along its length): a pointed oval of eight triangles. */
export function buildFlatLeaf(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-0.22, 0);
  s.quadraticCurveTo(-0.05, 0.14, 0.22, 0);
  s.quadraticCurveTo(-0.05, -0.14, -0.22, 0);
  const g = new ShapeGeometry(s, 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

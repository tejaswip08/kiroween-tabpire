// Skeletons from simple shapes, with vertex colours. Each builder returns one geometry with two groups: group 0 is the
// bone (and wood, rope and dirt), group 1 is the glowing eyes. So a skeleton is one mesh with two materials.
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../../../../lib/scene/rng';
import { paint } from './autumnBuild';

type P = [number, number, number];
const BONE = '#e9e0c8';
const BONE_DARK = '#bfb398';
const SOCKET = '#140a08';
const WOOD = '#4a3020';
const ROPE = '#8a6a3a';
const UP = new Vector3(0, 1, 0);

/** A bone from a to b: a thin cylinder with a knob at each end. */
function bone(a: P, b: P, r: number, color = BONE, knobs = true): BufferGeometry[] {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const d = new Vector3().subVectors(vb, va);
  const len = d.length();
  const g = new CylinderGeometry(r * 0.8, r, len, 5, 1, true);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()));
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  if (!knobs) return [paint(g, color)];
  return [paint(g, color), paint(new SphereGeometry(r * 1.45, 5, 4).translate(...a), color), paint(new SphereGeometry(r * 1.3, 5, 4).translate(...b), color)];
}
/** A box from a to b (wood, a crossbar). */
function beam(a: P, b: P, w: number, color: string): BufferGeometry {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const d = new Vector3().subVectors(vb, va);
  const g = new BoxGeometry(w, d.length(), w);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()));
  const m = va.add(vb).multiplyScalar(0.5);
  return paint(g.translate(m.x, m.y, m.z), color);
}

export interface Joints {
  head: P;
  /** Head tilt: forward (about x) and sideways (about z), radians. */
  tilt: [number, number];
  neck: P;
  chest: P;
  pelvis: P;
  shoulder: [P, P];
  elbow: [P, P];
  hand: [P, P];
  hip?: [P, P];
  knee?: [P, P];
  foot?: [P, P];
}

/** The skull: a round cranium, a jaw with teeth, dark sockets and a nose hole. Its eyes go in `eyes`. */
function skull(j: Joints, bones: BufferGeometry[], eyes: BufferGeometry[], s = 1): void {
  const [hx, hy, hz] = j.head;
  const place = (g: BufferGeometry) => g.rotateX(j.tilt[0]).rotateZ(j.tilt[1]).translate(hx, hy, hz);
  bones.push(paint(place(new SphereGeometry(0.15 * s, 8, 6).scale(1, 1.02, 1.12)), BONE));
  bones.push(paint(place(new BoxGeometry(0.16 * s, 0.06 * s, 0.13 * s).translate(0, -0.12 * s, 0.05 * s)), BONE_DARK));
  bones.push(paint(place(new BoxGeometry(0.12 * s, 0.025 * s, 0.02 * s).translate(0, -0.085 * s, 0.155 * s)), '#f6f0de'));
  for (const side of [-1, 1]) {
    bones.push(paint(place(new SphereGeometry(0.042 * s, 5, 4).translate(side * 0.055 * s, 0.0, 0.13 * s)), SOCKET));
    eyes.push(place(new SphereGeometry(0.019 * s, 5, 4).translate(side * 0.055 * s, 0.0, 0.165 * s)));
  }
  bones.push(paint(place(new ConeGeometry(0.02 * s, 0.045 * s, 3).rotateX(Math.PI).translate(0, -0.05 * s, 0.165 * s)), SOCKET));
}

/** A whole skeleton from its joints: skull, spine, ribs, pelvis, arms with hands, and legs when it has them. */
function skeleton(j: Joints, bones: BufferGeometry[], eyes: BufferGeometry[]): void {
  skull(j, bones, eyes);
  // Spine: vertebrae from the pelvis to the neck.
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const p: P = [j.pelvis[0] + (j.neck[0] - j.pelvis[0]) * t, j.pelvis[1] + (j.neck[1] - j.pelvis[1]) * t, j.pelvis[2] + (j.neck[2] - j.pelvis[2]) * t];
    bones.push(paint(new BoxGeometry(0.05, 0.035, 0.045).translate(...p), BONE_DARK));
  }
  // Ribs: open hoops around the chest, smaller toward the bottom.
  const up = new Vector3(...j.neck).sub(new Vector3(...j.pelvis)).normalize();
  const tilt = new Quaternion().setFromUnitVectors(UP, up);
  for (let i = 0; i < 4; i++) {
    const r = 0.14 - i * 0.012;
    const g = new TorusGeometry(r, 0.014, 3, 10, Math.PI * 1.55).rotateZ(-0.275 * Math.PI).rotateX(Math.PI / 2).scale(1, 1, 0.8);
    g.translate(0, -i * 0.065, -0.01).applyQuaternion(tilt).translate(...j.chest);
    bones.push(paint(g, BONE));
  }
  // Pelvis: a short wide hoop.
  bones.push(paint(new TorusGeometry(0.09, 0.022, 3, 8).rotateX(Math.PI / 2).scale(1.2, 1, 0.8).translate(...j.pelvis), BONE));
  // Shoulders, arms and hands (a palm and three fingers that curl).
  bones.push(...bone(j.shoulder[0], j.shoulder[1], 0.016));
  for (const k of [0, 1] as const) {
    bones.push(...bone(j.shoulder[k], j.elbow[k], 0.022), ...bone(j.elbow[k], j.hand[k], 0.019));
    const [ex, ey, ez] = j.elbow[k];
    const [hx, hy, hz] = j.hand[k];
    const dir = new Vector3(hx - ex, hy - ey, hz - ez).normalize();
    for (let f = -1; f <= 1; f++) {
      const side = new Vector3().crossVectors(dir, new Vector3(0, 0, 1)).normalize().multiplyScalar(f * 0.022);
      const tip: P = [hx + dir.x * 0.09 + side.x, hy + dir.y * 0.09 + side.y, hz + dir.z * 0.09 + side.z + 0.02];
      bones.push(...bone([hx + side.x * 0.6, hy + side.y * 0.6, hz + side.z * 0.6], tip, 0.008, BONE, false));
    }
  }
  if (j.hip && j.knee && j.foot) {
    for (const k of [0, 1] as const) {
      bones.push(...bone(j.hip[k], j.knee[k], 0.027), ...bone(j.knee[k], j.foot[k], 0.022));
      bones.push(paint(new BoxGeometry(0.07, 0.035, 0.15).translate(j.foot[k][0], j.foot[k][1] - 0.02, j.foot[k][2] + 0.05), BONE_DARK));
    }
  }
}

const finish = (bones: BufferGeometry[], eyes: BufferGeometry[]): BufferGeometry => {
  const body = mergeGeometries(bones.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  const glow = mergeGeometries(eyes.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return paint(n, '#ffffff');
  }))!;
  return mergeGeometries([body, glow], true)!;
};

/** Strung up on a wooden post with a crossbar, wrists roped to the bar, head slumped, legs dangling. About 2.95 tall. */
export function buildHungSkeleton(): BufferGeometry {
  const bones: BufferGeometry[] = [beam([0, -0.1, -0.12], [0, 2.95, -0.12], 0.13, WOOD), beam([-0.95, 2.32, -0.08], [0.95, 2.36, -0.08], 0.09, WOOD)];
  const eyes: BufferGeometry[] = [];
  skeleton({
    head: [0.04, 2.17, 0.06], tilt: [0.45, -0.25], neck: [0, 2.02, 0], chest: [0, 1.86, 0], pelvis: [0, 1.38, 0.01],
    shoulder: [[-0.17, 1.96, 0], [0.17, 1.96, 0]], elbow: [[-0.47, 2.22, 0], [0.47, 2.2, 0]], hand: [[-0.74, 2.3, 0.0], [0.76, 2.28, 0.0]],
    hip: [[-0.09, 1.33, 0.01], [0.09, 1.33, 0.01]], knee: [[-0.11, 0.93, 0.06], [0.1, 0.92, 0.03]], foot: [[-0.13, 0.55, 0.06], [0.12, 0.54, 0.02]],
  }, bones, eyes);
  for (const x of [-0.72, 0.74]) bones.push(paint(new CylinderGeometry(0.04, 0.04, 0.07, 6).rotateZ(Math.PI / 2).translate(x, 2.32, -0.02), ROPE));
  return finish(bones, eyes);
}
/** Slumped on the ground, back against something, knees up, hands in its lap, head lolling to one side. */
export function buildSittingSkeleton(): BufferGeometry {
  const bones: BufferGeometry[] = [];
  const eyes: BufferGeometry[] = [];
  skeleton({
    head: [0.07, 0.86, -0.08], tilt: [0.35, 0.45], neck: [0.02, 0.72, -0.14], chest: [0.01, 0.56, -0.12], pelvis: [0, 0.14, 0],
    shoulder: [[-0.17, 0.64, -0.13], [0.17, 0.64, -0.13]], elbow: [[-0.25, 0.38, -0.02], [0.26, 0.38, -0.03]], hand: [[-0.17, 0.27, 0.2], [0.2, 0.2, 0.22]],
    hip: [[-0.09, 0.1, 0.02], [0.09, 0.1, 0.02]], knee: [[-0.15, 0.36, 0.34], [0.16, 0.3, 0.36]], foot: [[-0.17, 0.05, 0.66], [0.2, 0.05, 0.68]],
  }, bones, eyes);
  return finish(bones, eyes);
}
/**
 * Climbing out of the ground: the upper body with both arms reaching up and clawing, the legs still below. Its origin is the
 * pelvis; the scene sinks it into the ground by how hungry the tabs are.
 */
export function buildRisingSkeleton(): BufferGeometry {
  const bones: BufferGeometry[] = [];
  const eyes: BufferGeometry[] = [];
  skeleton({
    head: [0, 0.72, 0.06], tilt: [-0.2, 0.15], neck: [0, 0.56, 0.02], chest: [0, 0.42, 0], pelvis: [0, 0, 0],
    shoulder: [[-0.17, 0.52, 0], [0.17, 0.52, 0]], elbow: [[-0.34, 0.78, 0.1], [0.33, 0.8, 0.06]], hand: [[-0.36, 1.06, 0.2], [0.38, 1.04, 0.16]],
    hip: [[-0.09, -0.05, 0], [0.09, -0.05, 0]], knee: [[-0.11, -0.42, 0.05], [0.1, -0.42, 0.04]], foot: [[-0.12, -0.78, 0.04], [0.12, -0.78, 0.03]],
  }, bones, eyes);
  return finish(bones, eyes);
}
/** A skull alone, sitting on top of a fence post: its base at y = 0. */
export function buildPostSkull(): BufferGeometry {
  const bones: BufferGeometry[] = [];
  const eyes: BufferGeometry[] = [];
  skull({ head: [0, 0.13, 0], tilt: [0.05, 0] } as Joints, bones, eyes, 0.85);
  return finish(bones, eyes);
}
/** The dirt mounds of the rising skeletons and the loose bones in the grass: one plain mesh (no glowing part). */
export function buildBoneyard(mounds: readonly { x: number; z: number; scale: number }[], loose: readonly [number, number, number, number][]): BufferGeometry {
  const rng = mulberry32(23);
  const parts: BufferGeometry[] = [];
  for (const m of mounds) {
    const g = new SphereGeometry(0.62 * m.scale, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.32, 1);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = 1 + 0.12 * Math.sin(pos.getX(i) * 9 + pos.getZ(i) * 7);
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    parts.push(paint(g.translate(m.x, -0.02, m.z), '#3a2414'));
    // Clods of earth thrown up around it.
    for (let c = 0; c < 4; c++) {
      const a = rng() * Math.PI * 2;
      parts.push(paint(new SphereGeometry(0.07 + rng() * 0.05, 4, 3).translate(m.x + Math.cos(a) * 0.75 * m.scale, 0.02, m.z + Math.sin(a) * 0.75 * m.scale), '#4a2e1a'));
    }
  }
  for (const [x, z, rot, s] of loose) {
    const g = mergeGeometries(bone([-0.2 * s, 0.035, 0], [0.2 * s, 0.035, 0], 0.025 * s).map((p) => (p.index ? p.toNonIndexed() : p)))!;
    parts.push(g.rotateY(rot).translate(x, 0, z));
  }
  return mergeGeometries(parts)!;
}

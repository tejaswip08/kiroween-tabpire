import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { layout } from '../../../../lib/scene/layout';
import { useDisplay } from './display';
import { collectParts, type Part } from './Props';

const urls = ['/models/kaykit/skull.gltf', '/models/kaykit/ribcage.gltf', '/models/kaykit/bone_B.gltf', '/models/kaykit/bone_C.gltf'];
/** At most this many mounds are drawn. */
const MAX_MOUNDS = 3;
/** How far the skull rises and sinks, in metres (2.5 cm). */
const SKULL_BOB = 0.025;

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3();
const tmpE = new Euler();

/** One instanced mesh per part of a model. */
function makeInstanced(parts: Part[], count: number): InstancedMesh[] {
  return parts.map((p) => {
    const m = new InstancedMesh(p.geometry, p.material, count);
    m.frustumCulled = false;
    m.userData.local = p.local;
    return m;
  });
}
function setAll(meshes: InstancedMesh[], i: number, base: Matrix4) {
  for (const m of meshes) m.setMatrixAt(i, tmpM.multiplyMatrices(base, m.userData.local as Matrix4));
}
const place = (x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number): Matrix4 =>
  new Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz, 'YXZ')), tmpS.set(s, s, s));

/** A half sphere with a lumpy surface (a smooth noise of the position, so the seam of the sphere stays closed). */
function lumpyDome(): SphereGeometry {
  const g = new SphereGeometry(1, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + 0.13 * Math.sin(x * 5.1 + z * 2.3) * Math.cos(z * 4.7 - y * 3.1) + 0.07 * Math.sin(x * 11 + y * 7 + z * 9);
    // The rim stays on the ground.
    p.setXYZ(i, x * k, y * (y < 0.02 ? 1 : k), z * k);
  }
  g.computeVertexNormals();
  return g;
}

interface Pose {
  /** Offset from the mound centre (x, y, z), tilts (x, y, z) and scale. */
  at: [number, number, number];
  tilt: [number, number, number];
  s: number;
}
/**
 * Per mound: which ribcage and bones poke out. Offsets are in the mound's own frame (turned by its rotY).
 * The skull's own pose is set in the frame loop.
 */
const RIBS: (Pose | null)[] = [
  { at: [-0.42, 0.2, -0.18], tilt: [0.45, 0.6, 0.5], s: 0.8 },
  null,
  { at: [0.4, 0.18, -0.2], tilt: [0.4, -0.5, -0.55], s: 0.75 },
];
const BONE_C: Pose[] = [
  { at: [0.38, 0.42, -0.12], tilt: [0, 0.3, 1.1], s: 1 },
  { at: [-0.4, 0.4, -0.15], tilt: [0.2, -0.2, -1.05], s: 1 },
  { at: [-0.35, 0.42, 0.05], tilt: [0, 0.5, -1.0], s: 0.95 },
];
const BONE_B: (Pose | null)[] = [
  null,
  { at: [0.42, 0.3, 0.2], tilt: [0, 0.8, 0.9], s: 1 },
  { at: [0.15, 0.3, -0.4], tilt: [0.3, 0.2, 1.2], s: 0.95 },
];

/**
 * Up to three dirt mounds beside the graves, each with a half-buried skull tilted on top and a ribcage or a
 * couple of bones poking out at an angle. The mounds are dark brown and a little lumpy. The skull rises and
 * sinks by about 2.5 cm very slowly (still with reduced motion). The bones are the Kaykit models, drawn with
 * instancing.
 */
export function Skeletons() {
  const display = useDisplay();
  const mounds = useMemo(() => layout().scenery.mounds.slice(0, MAX_MOUNDS), []);
  const gltfs = useGLTF(urls, false, true);
  const parts = useMemo(() => {
    const list = Array.isArray(gltfs) ? gltfs : [gltfs];
    const n = mounds.length;
    const skull = makeInstanced(collectParts(list[0]!.scene), n);
    const ribs = makeInstanced(collectParts(list[1]!.scene), n);
    const boneB = makeInstanced(collectParts(list[2]!.scene), n);
    const boneC = makeInstanced(collectParts(list[3]!.scene), n);
    const dome = new InstancedMesh(lumpyDome(), new MeshStandardMaterial({ color: '#33231a', roughness: 1, metalness: 0 }), n);
    dome.frustumCulled = false;
    dome.receiveShadow = true;
    return { skull, ribs, boneB, boneC, dome };
  }, [gltfs, mounds.length]);

  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    mounds.forEach((m, i) => {
      const c = Math.cos(m.rotY);
      const s = Math.sin(m.rotY);
      const at = (p: Pose) => place(m.x + p.at[0] * c + p.at[2] * s, p.at[1], m.z - p.at[0] * s + p.at[2] * c, p.tilt[0], p.tilt[1] + m.rotY, p.tilt[2], p.s);
      const hide = () => place(m.x, -5, m.z, 0, 0, 0, 0.0001);
      parts.dome.setMatrixAt(i, place(m.x, -0.05, m.z, 0, m.rotY, 0, 1).scale(tmpS.set(0.95, 0.42, 0.85)));
      // The skull sits low on the mound, tipped back and toward the camera, about a third of it in the soil.
      const face = Math.atan2(0.5 - m.x, 16 - m.z);
      const bob = display.reduced ? 0 : SKULL_BOB * Math.sin(t * 0.45 + m.seed * 2.1);
      setAll(parts.skull, i, place(m.x, 0.2 + bob, m.z + 0.08, -0.55, face, 0.12 * (m.seed - 1), 0.52));
      const rib = RIBS[i % RIBS.length] ?? null;
      setAll(parts.ribs, i, rib ? at(rib) : hide());
      setAll(parts.boneC, i, at(BONE_C[i % BONE_C.length]!));
      const b = BONE_B[i % BONE_B.length] ?? null;
      setAll(parts.boneB, i, b ? at(b) : hide());
    });
    for (const m of [...parts.skull, ...parts.ribs, ...parts.boneB, ...parts.boneC, parts.dome]) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={parts.dome} />
      {[...parts.skull, ...parts.ribs, ...parts.boneB, ...parts.boneC].map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

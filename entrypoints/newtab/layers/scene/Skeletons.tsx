import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { skeletonRise } from '../../../../lib/scene/critters';
import { layout } from '../../../../lib/scene/layout';
import { useDisplay } from './display';
import { collectParts, type Part } from './Props';

const urls = ['/models/kaykit/skull.gltf', '/models/kaykit/ribcage.gltf', '/models/kaykit/bone_B.gltf', '/models/kaykit/bone_C.gltf'];

const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3();
const tmpE = new Euler();

/** One instanced mesh per part of a model; `set` puts an instance in place. */
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

/**
 * Skeletons rising from the soil: three dirt mounds where a skull, a ribcage and two bony hands slowly push up
 * and then sink back, in a loop (not gory: just cute-spooky bones). Each mound has its own timing. The bones
 * are the Kaykit models, drawn with instancing: one call each for the mounds, skulls, ribcages, arms and fingers.
 */
export function Skeletons() {
  const display = useDisplay();
  const mounds = useMemo(() => layout().scenery.mounds, []);
  const gltfs = useGLTF(urls, false, true);
  const parts = useMemo(() => {
    const list = Array.isArray(gltfs) ? gltfs : [gltfs];
    const skull = makeInstanced(collectParts(list[0]!.scene), mounds.length);
    const ribs = makeInstanced(collectParts(list[1]!.scene), mounds.length);
    const arms = makeInstanced(collectParts(list[2]!.scene), mounds.length * 2);
    const fingers = makeInstanced(collectParts(list[3]!.scene), mounds.length * 4);
    const dome = new InstancedMesh(
      new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new MeshStandardMaterial({ color: '#41302a', roughness: 1, metalness: 0 }),
      mounds.length,
    );
    dome.frustumCulled = false;
    dome.receiveShadow = true;
    return { skull, ribs, arms, fingers, dome };
  }, [gltfs, mounds.length]);

  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    mounds.forEach((m, i) => {
      const r = display.reduced ? 0.6 : skeletonRise(t, m.seed);
      // Turn toward the camera.
      const face = Math.atan2(0.5 - m.x, 16 - m.z);
      // The mound heaves a little as the bones push up.
      parts.dome.setMatrixAt(i, place(m.x, 0, m.z, 0, m.rotY, 0, 1).scale(tmpS.set(0.85, (0.32 + 0.1 * r) / 1, 0.85)));
      const wob = display.reduced ? 0 : Math.sin(t * 1.3 + m.seed) * 0.04;
      setAll(parts.skull, i, place(m.x, -0.78 + r * 0.98, m.z + 0.05, -0.3 * (1 - r) + wob, face, 0, 0.8));
      setAll(parts.ribs, i, place(m.x, -0.55 + r * 0.64, m.z - 0.25, 0.25, face, 0, 1.15));
      // Two arms reach up and out of the soil, waving a little, each ending in two fingers.
      for (const [k, side] of [-1, 1].entries()) {
        const rr = Math.min(1, Math.max(0, r * 1.25 - 0.1));
        const lean = 0.55 - 0.25 * rr + (display.reduced ? 0 : Math.sin(t * 1.4 + m.seed + side * 1.7) * 0.12 * rr);
        const dx = side * Math.sin(lean);
        const dy = Math.cos(lean);
        const cos = Math.cos(face);
        const sin = Math.sin(face);
        // The mound's own sideways direction (turned toward the camera).
        const sx = cos;
        const sz = -sin;
        const bx = m.x + sx * side * 0.62;
        const bz = m.z + sz * side * 0.62 + 0.1;
        const by = -0.55 + rr * 0.62;
        const phi = Math.atan2(dy, dx);
        const armLen = 1.05;
        const cx = bx + sx * dx * armLen * 0.5;
        const cy = by + dy * armLen * 0.5;
        const cz = bz + sz * dx * armLen * 0.5;
        const armBase = new Matrix4().compose(tmpP.set(cx, cy, cz), tmpQ.setFromEuler(tmpE.set(0, face, phi, 'YXZ')), tmpS.set(1.7, 1.7, 1.7));
        setAll(parts.arms, i * 2 + k, armBase);
        const tipx = bx + sx * dx * armLen;
        const tipy = by + dy * armLen;
        const tipz = bz + sz * dx * armLen;
        for (let f = 0; f < 2; f++) {
          const fa = phi + (f - 0.5) * 0.6;
          const fx = Math.cos(fa);
          const fy = Math.sin(fa);
          const fl = 0.3;
          const fm = new Matrix4().compose(
            tmpP.set(tipx + sx * fx * fl * 0.5, tipy + fy * fl * 0.5, tipz + sz * fx * fl * 0.5),
            tmpQ.setFromEuler(tmpE.set(0, face, fa, 'YXZ')),
            tmpS.set(0.3, 0.3, 0.3),
          );
          setAll(parts.fingers, (i * 2 + k) * 2 + f, fm);
        }
      }
    });
    for (const m of [...parts.skull, ...parts.ribs, ...parts.arms, ...parts.fingers, parts.dome]) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={parts.dome} />
      {[...parts.skull, ...parts.ribs, ...parts.arms, ...parts.fingers].map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

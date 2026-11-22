import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Euler, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { crowPose } from '../../../../lib/scene/critters';
import { layout } from '../../../../lib/scene/layout';
import { at, ball, cone, mergePieces } from './critterGeo';
import { useDisplay } from './display';

const FEATHER: [number, number, number] = [0.025, 0.022, 0.04];
const WING: [number, number, number] = [0.05, 0.045, 0.08];
const BEAK: [number, number, number] = [0.16, 0.13, 0.12];
const SCALE = 2.4;

const tmpM = new Matrix4();
const tmpHead = new Matrix4();
const tmpQ = new Quaternion();
const tmpP = new Vector3();
const tmpS = new Vector3(SCALE, SCALE, SCALE);
const tmpE = new Euler();
const NECK = new Matrix4().makeTranslation(0, 0.27, 0.11);

/**
 * Crows perched on the fence posts and the dead trees. Each one sits still with a small head bob, and now
 * and then turns its head to look around or hops. Two instanced meshes: the bodies and the heads.
 */
export function Crows() {
  const display = useDisplay();
  const crows = useMemo(() => layout().scenery.crows, []);
  const bodyGeo = useMemo(
    () =>
      mergePieces([
        { geo: ball(0.12, 10, 7), matrix: at(0, 0.2, 0, 1, 0.9, 1.55), color: FEATHER }, // body
        { geo: ball(0.1, 8, 6), matrix: at(-0.1, 0.2, -0.02, 0.35, 0.9, 1.7), color: WING }, // folded wings
        { geo: ball(0.1, 8, 6), matrix: at(0.1, 0.2, -0.02, 0.35, 0.9, 1.7), color: WING },
        { geo: cone(0.07, 0.3, 4), matrix: at(0, 0.14, -0.3, 1, 1, 0.5, Math.PI / 2 + 0.2, 0, 0), color: FEATHER }, // tail
        { geo: cone(0.012, 0.12, 4), matrix: at(-0.04, 0.06, 0.02), color: BEAK }, // legs
        { geo: cone(0.012, 0.12, 4), matrix: at(0.04, 0.06, 0.02), color: BEAK },
      ]),
    [],
  );
  const headGeo = useMemo(
    () =>
      mergePieces([
        { geo: ball(0.075, 9, 7), matrix: at(0, 0.02, 0.0), color: FEATHER },
        { geo: cone(0.03, 0.14, 4), matrix: at(0, 0.0, 0.12, 1, 1, 1, Math.PI / 2, 0, 0), color: BEAK },
      ]),
    [],
  );
  const { bodies, heads } = useMemo(() => {
    const mat = new MeshBasicMaterial({ vertexColors: true });
    const bodies = new InstancedMesh(bodyGeo, mat, crows.length);
    const heads = new InstancedMesh(headGeo, mat, crows.length);
    for (const m of [bodies, heads]) {
      m.frustumCulled = false;
      m.castShadow = false;
    }
    return { bodies, heads };
  }, [bodyGeo, headGeo, crows.length]);

  useFrame(() => {
    crows.forEach((c, i) => {
      const pose = crowPose(display.reduced ? 0 : display.time, c.seed);
      tmpP.set(c.x, c.y + pose.hop * SCALE, c.z);
      tmpQ.setFromEuler(tmpE.set(0, c.rotY, 0));
      tmpM.compose(tmpP, tmpQ, tmpS);
      bodies.setMatrixAt(i, tmpM);
      // The head turns and nods about the neck.
      tmpHead.copy(tmpM).multiply(NECK);
      tmpQ.setFromEuler(tmpE.set(pose.headPitch, pose.headYaw, 0, 'YXZ'));
      tmpHead.multiply(tmpM.makeRotationFromQuaternion(tmpQ));
      heads.setMatrixAt(i, tmpHead);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <primitive object={bodies} />
      <primitive object={heads} />
    </>
  );
}

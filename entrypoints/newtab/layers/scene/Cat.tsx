import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { catTailAngle } from '../../../../lib/scene/critters';
import { layout } from '../../../../lib/scene/layout';
import { at, ball, cone, mergePieces } from './critterGeo';
import { useDisplay } from './display';

const FUR: [number, number, number] = [0.02, 0.016, 0.03];
const EYE: [number, number, number] = [3.4, 2.5, 0.15];

/**
 * A black cat with glowing yellow eyes, sitting on a gravestone, its tail swishing. Drawn with three small meshes: the body, the tail and the eyes.
 */
export function Cat() {
  const display = useDisplay();
  const cat = useMemo(() => layout().scenery.cat, []);
  const tail = useRef<Group>(null);
  const body = useMemo(
    () =>
      mergePieces([
        { geo: ball(0.27, 12, 8), matrix: at(0, 0.3, 0, 0.95, 1.25, 0.95), color: FUR }, // chest and body
        { geo: ball(0.25, 10, 7), matrix: at(0, 0.2, -0.15, 1.05, 0.85, 1.0), color: FUR }, // haunches
        { geo: ball(0.17, 12, 8), matrix: at(0, 0.7, 0.08), color: FUR }, // head
        { geo: cone(0.065, 0.17, 4), matrix: at(-0.1, 0.86, 0.06, 1, 1, 1, 0, 0, 0.25), color: FUR }, // ears
        { geo: cone(0.065, 0.17, 4), matrix: at(0.1, 0.86, 0.06, 1, 1, 1, 0, 0, -0.25), color: FUR },
        { geo: ball(0.07, 8, 6), matrix: at(-0.12, 0.05, 0.22, 1.1, 0.7, 1.6), color: FUR }, // front paws
        { geo: ball(0.07, 8, 6), matrix: at(0.12, 0.05, 0.22, 1.1, 0.7, 1.6), color: FUR },
      ]),
    [],
  );
  const eyes = useMemo(
    () =>
      mergePieces([
        { geo: ball(0.036, 8, 6), matrix: at(-0.075, 0.72, 0.235, 1, 1.5, 0.6), color: EYE },
        { geo: ball(0.036, 8, 6), matrix: at(0.075, 0.72, 0.235, 1, 1.5, 0.6), color: EYE },
      ]),
    [],
  );
  const tailGeo = useMemo(() => mergePieces([{ geo: ball(0.045, 8, 6), matrix: at(0, 0.16, 0, 1, 4.2, 1), color: FUR }, { geo: ball(0.05, 8, 6), matrix: at(0, 0.34, 0, 1, 1, 1), color: FUR }]), []);

  useFrame(() => {
    if (tail.current) {
      // The tail rises from the haunches and sways from side to side.
      tail.current.rotation.set(-1.15, 0, display.reduced ? 0 : catTailAngle(display.time));
    }
  });

  return (
    <group position={[cat.x, cat.y, cat.z]} rotation={[0, cat.rotY, 0]} scale={1.6}>
      <mesh geometry={body} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.8} metalness={0} />
      </mesh>
      <mesh geometry={eyes} frustumCulled={false}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <group ref={tail} position={[0, 0.18, -0.3]}>
        <mesh geometry={tailGeo} frustumCulled={false}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

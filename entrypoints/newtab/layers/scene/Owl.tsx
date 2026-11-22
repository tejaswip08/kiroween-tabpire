import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { owlEyeOpen, owlHeadYaw } from '../../../../lib/scene/critters';
import { layout } from '../../../../lib/scene/layout';
import { at, ball, cone, mergePieces, stickBetween } from './critterGeo';
import { useDisplay } from './display';

const BROWN: [number, number, number] = [0.2, 0.12, 0.08];
const DARK: [number, number, number] = [0.1, 0.06, 0.05];
const BELLY: [number, number, number] = [0.42, 0.3, 0.2];
const FACE: [number, number, number] = [0.5, 0.38, 0.27];
const BEAK: [number, number, number] = [0.8, 0.45, 0.12];
const WOOD: [number, number, number] = [0.07, 0.05, 0.06];
const EYE: [number, number, number] = [3.4, 2.4, 0.1];
const SCALE = 1.8;

/**
 * An owl with big glowing eyes on a bare branch. It blinks every few seconds and slowly turns a little.
 * Two meshes: the owl with its branch, and the eyes (which close to blink).
 */
export function Owl() {
  const display = useDisplay();
  const owl = useMemo(() => layout().scenery.owl, []);
  const swivel = useRef<Group>(null);
  const eyes = useRef<Mesh>(null);
  const body = useMemo(() => {
    const b = owl.branch;
    // The branch, in the owl's own space (the owl sits at its tip).
    const rel = (x: number, y: number, z: number): [number, number, number] => [(x - owl.x) / SCALE, (y - owl.y) / SCALE, (z - owl.z) / SCALE];
    return mergePieces([
      { geo: stickBetween(rel(b[0], b[1], b[2]), rel(b[3], b[4], b[5]), 0.07 / 1.0), color: WOOD },
      { geo: ball(0.3, 12, 9), matrix: at(0, 0.33, 0, 0.9, 1.2, 0.8), color: BROWN }, // body
      { geo: ball(0.2, 10, 7), matrix: at(0, 0.3, 0.17, 0.8, 1.1, 0.5), color: BELLY }, // belly
      { geo: ball(0.25, 12, 9), matrix: at(0, 0.72, 0.02, 1.05, 0.95, 0.9), color: BROWN }, // head
      { geo: ball(0.2, 10, 8), matrix: at(0, 0.72, 0.12, 1.15, 0.9, 0.5), color: FACE }, // face disc
      { geo: cone(0.07, 0.2, 4), matrix: at(-0.17, 0.95, 0, 1, 1, 1, 0, 0, 0.3), color: DARK }, // ear tufts
      { geo: cone(0.07, 0.2, 4), matrix: at(0.17, 0.95, 0, 1, 1, 1, 0, 0, -0.3), color: DARK },
      { geo: cone(0.045, 0.12, 4), matrix: at(0, 0.66, 0.26, 1, 1, 1, Math.PI / 2, 0, 0), color: BEAK }, // beak
      { geo: ball(0.2, 9, 7), matrix: at(-0.26, 0.33, -0.03, 0.4, 1.25, 0.75), color: DARK }, // wings
      { geo: ball(0.2, 9, 7), matrix: at(0.26, 0.33, -0.03, 0.4, 1.25, 0.75), color: DARK },
      { geo: ball(0.04, 6, 5), matrix: at(-0.1, 0.02, 0.1, 1, 0.6, 1.8), color: DARK }, // feet
      { geo: ball(0.04, 6, 5), matrix: at(0.1, 0.02, 0.1, 1, 0.6, 1.8), color: DARK },
    ]);
  }, [owl]);
  const eyeGeo = useMemo(
    () =>
      mergePieces([
        { geo: ball(0.085, 10, 8), matrix: at(-0.1, 0.75, 0.24, 1, 1, 0.45), color: EYE },
        { geo: ball(0.085, 10, 8), matrix: at(0.1, 0.75, 0.24, 1, 1, 0.45), color: EYE },
        { geo: ball(0.03, 6, 5), matrix: at(-0.1, 0.75, 0.275, 1, 1, 0.4), color: [0.02, 0.01, 0.0] },
        { geo: ball(0.03, 6, 5), matrix: at(0.1, 0.75, 0.275, 1, 1, 0.4), color: [0.02, 0.01, 0.0] },
      ]),
    [],
  );
  useFrame(() => {
    const t = display.reduced ? 0 : display.time;
    if (swivel.current) swivel.current.rotation.y = owl.rotY + owlHeadYaw(t);
    if (eyes.current) {
      // Blinking closes the eyes: they squash flat about the line through their middle.
      const open = display.reduced ? 1 : owlEyeOpen(t);
      eyes.current.scale.y = 0.06 + 0.94 * open;
      eyes.current.position.y = 0.75 * (1 - eyes.current.scale.y);
    }
  });
  return (
    <group position={[owl.x, owl.y, owl.z]} scale={SCALE}>
      <group ref={swivel}>
        <mesh geometry={body} frustumCulled={false}>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
        <mesh ref={eyes} geometry={eyeGeo} frustumCulled={false}>
          <meshBasicMaterial vertexColors toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

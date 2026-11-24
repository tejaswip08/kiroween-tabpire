import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color, DoubleSide, MeshBasicMaterial } from 'three';
import { FLOOR_Y, HOUSE } from '../../../../../lib/scene/uniqueScenes/house';
import { useDisplay } from '../display';
import { GLOW_COLOR, buildHouse } from './houseBuild';

const GLOW = new Color(GLOW_COLOR);
/** A slow, uneven flicker between about 70% and 100% of the glow, never fully out. */
export const flicker = (t: number, phase: number): number => 0.84 + 0.1 * Math.sin(t * 1.3 + phase) + 0.06 * Math.sin(t * 3.7 + phase * 2.3);

/**
 * The old haunted house on its dark hill at the right edge: a dark silhouette (the fog fades it into the dusk) with four
 * dim windows that flicker slowly. The hill sits on the ground; the group is lifted so the floor stands on the hill.
 * Four meshes (body, two groups of panes). With reduced motion the windows glow steadily.
 */
export function HauntedHouse() {
  const display = useDisplay();
  const parts = useMemo(buildHouse, []);
  const [a, b] = useMemo(() => [new MeshBasicMaterial({ color: GLOW.clone(), fog: true }), new MeshBasicMaterial({ color: GLOW.clone(), fog: true, side: DoubleSide })], []);
  useEffect(
    () => () => {
      parts.body.dispose();
      parts.panesA.dispose();
      parts.panesB.dispose();
      a.dispose();
      b.dispose();
    },
    [parts, a, b],
  );
  useFrame(() => {
    const fa = display.reduced ? 0.85 : flicker(display.time, 0);
    const fb = display.reduced ? 0.85 : flicker(display.time, 2.4);
    a.color.copy(GLOW).multiplyScalar(fa);
    b.color.copy(GLOW).multiplyScalar(fb);
  });
  return (
    <group position={[HOUSE.x, FLOOR_Y * HOUSE.scale, HOUSE.z]} rotation={[0, HOUSE.rotY, 0]} scale={HOUSE.scale} name="haunted-house">
      <mesh geometry={parts.body} frustumCulled={false} name="haunted-house-body">
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} side={DoubleSide} />
      </mesh>
      <mesh geometry={parts.panesA} material={a} frustumCulled={false} name="haunted-house-windows-a" />
      <mesh geometry={parts.panesB} material={b} frustumCulled={false} name="haunted-house-windows-b" />
    </group>
  );
}

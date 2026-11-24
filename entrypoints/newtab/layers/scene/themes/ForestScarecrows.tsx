import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { scarecrowSway, type ScarecrowSpot } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { useDisplay } from '../display';
import { buildWitchScarecrow } from './forestShapes';
/**
 * The scarecrows: a big one in the right foreground and two smaller ones along the path. They share one geometry (one draw
 * call each) and sway a little about their posts. With reduced motion they stand still.
 */
export function ForestScarecrows({ spots }: { spots: readonly ScarecrowSpot[] }) {
  const display = useDisplay();
  const geometry = useMemo(() => buildWitchScarecrow(), []);
  const groups = useRef<(Group | null)[]>([]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    spots.forEach((s, i) => {
      const g = groups.current[i];
      if (g) g.rotation.z = scarecrowSway(s, display.time, display.reduced);
    });
  });
  return (
    <>
      {spots.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[s.x, 0, s.z]}
          rotation={[0, s.rotY, 0]}
          scale={s.scale}
        >
          <mesh geometry={geometry} name="forest-scarecrow" castShadow>
            <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

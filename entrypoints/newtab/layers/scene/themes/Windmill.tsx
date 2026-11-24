import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { modelFile, type Placement } from '../../../../../lib/scene/layout';
import { useDisplay } from '../display';
import { buildWindmill } from './windmillBuild';

/** Radians per second: one turn takes about 25 seconds. */
export const SAIL_SPEED = 0.25;

/**
 * The windmill: its body stands still and its sails turn slowly about the hub. The two are separate meshes (two draw
 * calls for one model). The sails stand still with reduced motion. Suspends while the file loads.
 */
export function Windmill({ placement }: { placement: Placement }) {
  const display = useDisplay();
  const gltf = useGLTF(modelFile('farm_windmill'), false, true);
  const parts = useMemo(() => buildWindmill((Array.isArray(gltf) ? gltf[0]! : gltf).scene), [gltf]);
  useEffect(
    () => () => {
      parts?.body.dispose();
      parts?.blades?.dispose();
    },
    [parts],
  );
  const sails = useRef<Mesh>(null);
  useFrame(() => {
    if (sails.current) sails.current.rotation.z = display.reduced ? 0 : -display.time * SAIL_SPEED;
  });
  if (!parts) return null;
  return (
    <group position={[placement.x, placement.y, placement.z]} rotation={[0, placement.rotY, 0]} scale={placement.scale} name="windmill">
      <mesh geometry={parts.body} material={parts.material} frustumCulled={false} name="windmill-body" />
      {parts.blades && (
        <group position={[parts.hub.x, parts.hub.y, parts.hub.z]}>
          <mesh ref={sails} geometry={parts.blades} material={parts.material} frustumCulled={false} name="windmill-sails" />
        </group>
      )}
    </group>
  );
}

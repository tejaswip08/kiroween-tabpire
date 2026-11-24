import { useEffect, useMemo } from 'react';
import type { PlatformStep } from '../../../../../lib/scene/uniqueScenes/bloodmoonParts';
import { buildPlatform } from './shapes';

/** The stepped stone platform under the Blood Moon ruins: one merged mesh (one draw call) of dark stone. */
export function StonePlatform({ steps }: { steps: readonly PlatformStep[] }) {
  const geometry = useMemo(() => buildPlatform(steps), [steps]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow name="stone-platform">
      <meshStandardMaterial vertexColors roughness={1} metalness={0} emissive="#240a10" emissiveIntensity={0.5} flatShading />
    </mesh>
  );
}

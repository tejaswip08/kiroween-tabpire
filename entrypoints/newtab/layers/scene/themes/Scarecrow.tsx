import { useEffect, useMemo } from 'react';
import { buildScarecrow } from './shapes';

/** The scarecrow: one merged mesh of simple shapes, one draw call. */
export function Scarecrow({ x, z, rotY, scale }: { x: number; z: number; rotY: number; scale: number }) {
  const geometry = useMemo(() => buildScarecrow(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[x, 0, z]} rotation={[0, rotY, 0]} scale={scale} name="scarecrow">
      <meshStandardMaterial vertexColors roughness={1} metalness={0} flatShading />
    </mesh>
  );
}

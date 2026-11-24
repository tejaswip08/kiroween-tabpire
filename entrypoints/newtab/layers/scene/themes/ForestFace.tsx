import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, type MeshBasicMaterial } from 'three';
import { flicker } from '../../../../../lib/scene/flicker';
import type { FacePose } from '../../../../../lib/scene/uniqueScenes/forestParts';
import { useDisplay } from '../display';
import { buildFace } from './forestShapes';
/** The glow of the carving: HDR orange, so Bloom picks it up. */
const FACE_COLOR = new Color(1, 0.42, 0.06).multiplyScalar(3.2);
/**
 * The jack-o'-lantern face on the haunted tree: angry triangle eyes, a nose and a jagged mouth, glowing orange with a
 * gentle flicker (steady with reduced motion). One merged mesh, one draw call.
 */
export function ForestFace({ pose }: { pose: FacePose }) {
  const display = useDisplay();
  const geometry = useMemo(() => buildFace(), []);
  const material = useRef<MeshBasicMaterial>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    material.current?.color.copy(FACE_COLOR).multiplyScalar(flicker(display.time, 21, display.reduced));
  });
  return (
    <mesh geometry={geometry} position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]} scale={pose.scale} name="forest-face" renderOrder={1}>
      <meshBasicMaterial ref={material} color={FACE_COLOR} toneMapped={false} fog={false} side={DoubleSide} />
    </mesh>
  );
}

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type Group, type Object3D } from 'three';
import { COFFIN } from '../../../../lib/vampire/rig';
import type { PortraitRef } from './shared';

export const COFFIN_URL = '/models/coffin.glb';
useGLTF.preload(COFFIN_URL, false, false);

/** The open coffin the sleeping vampire lies in. Its lid is turned up and moved to the back. */
export function Coffin({ state }: { state: PortraitRef }) {
  const gltf = useGLTF(COFFIN_URL, false, false);
  const group = useRef<Group>(null);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    let lid: Object3D | undefined;
    root.traverse((o) => {
      if (o.name === 'lid') lid = o;
    });
    if (lid) {
      // Stand the lid up behind the coffin, like a door swung open.
      (lid as Object3D).position.set(COFFIN.lidOpenShift.x, COFFIN.bodyHeight + COFFIN.lidOpenShift.y, COFFIN.lidOpenShift.z);
      (lid as Object3D).rotation.x = COFFIN.lidOpenAngle;
    }
    return root;
  }, [gltf]);
  useFrame(() => {
    const g = group.current;
    const s = state.current;
    if (!g || !s) return;
    const rise = s.exit ? s.exit.coffin : s.pose.lying;
    g.visible = rise > 0.01;
    // The coffin rises from below the portrait during the Coffin exit.
    g.position.y = -(1 - Math.min(1, rise)) * 0.7;
  });
  return (
    <group ref={group} visible={false}>
      <primitive object={scene} />
    </group>
  );
}

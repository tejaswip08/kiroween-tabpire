// Kenney Graveyard Kit (CC0, www.kenney.nl): the rising coffin effect and the shared moonlight rig.
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneDeep } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Stage } from '../../lib/hunger';
import { progress } from './Effects';
import { FX_MS, ease, span } from './toon';

export const modelUrl = (name: string) => `/models/${name}.glb`;

// Only the coffin is still used (the rising-coffin effect); other Kenney models were replaced.
const MODELS = ['coffin'];
MODELS.forEach((m) => useGLTF.preload(modelUrl(m)));

/** Kenney coffin that rises from the grave and shuts its lid over the sinking vampire. */
export function RisingCoffin({ start }: { start: React.RefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl('coffin'));
  const { obj, lid, s } = useMemo(() => {
    const o = cloneDeep(scene);
    return { obj: o, lid: o.getObjectByName('lid'), s: 0.9 / new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).z };
  }, [scene]);
  useFrame(() => {
    const p = progress(start, FX_MS.coffin);
    if (!g.current) return;
    g.current.position.y = -0.3 + ease.out(span(p, 0, 0.35)) * 0.3;
    if (lid) {
      const close = ease.in(span(p, 0.5, 0.85));
      lid.rotation.x = -1.6 * (1 - close);
    }
  });
  return (
    <group ref={g} position={[0, -0.3, 0.05]}>
      <primitive object={obj} scale={s} />
    </group>
  );
}

/** Moonlit lighting shared by every graveyard view. */
export function Moonlight({ stage, candle }: { stage?: Stage; candle?: [number, number, number] }) {
  const flame = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (flame.current) {
      const t = state.clock.elapsedTime;
      flame.current.intensity = 0.7 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.1;
    }
  });
  return (
    <>
      <hemisphereLight args={['#a8a2ff', '#1a1030', 1.5]} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.7} color="#fff1e0" />
      <directionalLight position={[-2, 3.5, -3]} intensity={2.4} color="#9fb0ff" />
      {candle && <pointLight ref={flame} position={candle} distance={1.4} color="#ffb15c" />}
      {stage === 'starving' && <pointLight position={[0, 1.6, 1.4]} intensity={1.4} distance={3.5} color="#ff3b4d" />}
    </>
  );
}

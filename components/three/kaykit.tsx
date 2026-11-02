// KayKit Halloween Bits (CC0, www.kaylousberg.com) models.
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export const kayUrl = (name: string) => `/models/kaykit/${name}.gltf`;

export type KayName =
  | 'crypt' | 'arch_gate' | 'fence' | 'fence_pillar' | 'fence_broken' | 'gravestone' | 'grave_A' | 'grave_B'
  | 'gravemarker_A' | 'gravemarker_B' | 'tree_dead_large_decorated' | 'tree_dead_large' | 'tree_dead_medium'
  | 'tree_pine_orange_large' | 'tree_pine_orange_medium' | 'tree_pine_yellow_medium' | 'pumpkin_orange_jackolantern'
  | 'pumpkin_yellow_jackolantern' | 'pumpkin_orange' | 'pumpkin_yellow_small' | 'candle_triple' | 'candle_melted'
  | 'lantern_standing' | 'post_lantern' | 'skull_candle' | 'coffin_decorated' | 'floor_dirt' | 'floor_dirt_small'
  | 'shrine_candles' | 'ribcage' | 'bone_A' | 'skull' | 'path_A' | 'path_B' | 'path_C' | 'post_skull' | 'post'
  | 'lantern_hanging' | 'bench_decorated' | 'plaque_candles' | 'pillar' | 'grave_A_destroyed' | 'candle_thin'
  | 'bone_B' | 'bone_C' | 'arch' | 'shrine';

/** A KayKit model at its native scale (1 unit ≈ 1 m), casting and receiving shadows. */
export function Kay({ name, shadows = true, ...rest }: { name: KayName; shadows?: boolean } & ThreeElements['group']) {
  const { scene } = useGLTF(kayUrl(name));
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
      }
    });
    return o;
  }, [scene, shadows]);
  return (
    <group {...rest}>
      <primitive object={obj} />
    </group>
  );
}

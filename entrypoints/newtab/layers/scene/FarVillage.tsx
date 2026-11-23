import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, InstancedMesh, type Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { FAR_ITEMS } from '../../../../lib/scene/depth';
import { C } from './colors';
import { useDisplay } from './display';
import { buildFarVillage } from './farBuild';
import { assetUrl } from '../../../../lib/assetUrl';

const urls = [
  assetUrl('models/quaternius/farm_barn.glb'),
  assetUrl('models/quaternius/farm_windmill.glb'),
  assetUrl('models/quaternius/castle_fortress.glb'),
  assetUrl('models/quaternius/blood_ruins.glb'),
];

/**
 * The far background: hills with a small haunted village on them, as dark silhouettes in the fog. The barn,
 * windmill, fortress and ruins are the Quaternius models; the church and houses are built from simple shapes.
 * Everything still is merged into one mesh. The windmill's sails are a second mesh that turns slowly. A few
 * windows glow warm orange. This whole layer is one to three draw calls.
 */
export function FarVillage() {
  const display = useDisplay();
  const sails = useRef<Mesh>(null);
  const gltfs = useGLTF(urls, false, true);

  const built = useMemo(() => {
    const [barn, windmill, fortress, ruins] = (Array.isArray(gltfs) ? gltfs : [gltfs]).map((g) => g.scene);
    return buildFarVillage({ barn: barn!, windmill: windmill!, fortress: fortress!, ruins: ruins! });
  }, [gltfs]);

  const silhouette = useMemo(() => new MeshBasicMaterial({ color: new Color('#190c36').lerp(C.fog, 0.22), fog: true }), []);
  const windowMesh = useMemo(() => {
    const mat = new MeshBasicMaterial({ color: new Color(3.6, 1.5, 0.35), toneMapped: false, fog: true, side: DoubleSide });
    const m = new InstancedMesh(new PlaneGeometry(1, 1), mat, Math.max(1, built.wins.length));
    built.wins.forEach((w, i) => m.setMatrixAt(i, w));
    m.count = built.wins.length;
    m.frustumCulled = false;
    m.renderOrder = -50;
    return m;
  }, [built]);
  const windmillItem = FAR_ITEMS.find((i) => i.kind === 'windmill')!;

  useFrame(() => {
    // The sails turn slowly about the hub (a turn takes about 25 seconds). Still with reduced motion.
    if (sails.current) sails.current.rotation.z = -display.time * 0.25;
  });

  return (
    <>
      <mesh geometry={built.village} material={silhouette} frustumCulled={false} renderOrder={-60} />
      <primitive object={windowMesh} />
      {built.bladeGeo && (
        <group position={built.hubWorld} rotation={[0, windmillItem.rotY, 0]} scale={windmillItem.scale}>
          <mesh ref={sails} geometry={built.bladeGeo} material={silhouette} frustumCulled={false} renderOrder={-60} />
        </group>
      )}
    </>
  );
}

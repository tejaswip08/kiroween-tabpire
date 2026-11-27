import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DoubleSide, InstancedMesh, type Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { FAR_ITEMS, FAR_SINK } from '../../../../lib/scene/depth';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync } from './themeColors';
import { buildFarVillage } from './farBuild';
import { assetUrl } from '../../../../lib/assetUrl';

/** How much of the fog colour the far village silhouette takes. */
const SILHOUETTE_FOG_MIX = 0.22;
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

  const silhouette = useMemo(() => {
    const crypt = sceneColorsFor('crypt');
    return new MeshBasicMaterial({ color: crypt.farSilhouette.clone().lerp(crypt.fog, SILHOUETTE_FOG_MIX), fog: true });
  }, []);
  useColorSync((c) => {
    silhouette.color.copy(c.farSilhouette).lerp(c.fog, SILHOUETTE_FOG_MIX);
  });
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
    <group position={[0, -FAR_SINK, 0]}>
      <mesh geometry={built.village} material={silhouette} frustumCulled={false} renderOrder={-60} />
      <primitive object={windowMesh} />
      {built.bladeGeo && (
        <group position={built.hubWorld} rotation={[0, windmillItem.rotY, 0]} scale={windmillItem.scale}>
          <mesh ref={sails} geometry={built.bladeGeo} material={silhouette} frustumCulled={false} renderOrder={-60} />
        </group>
      )}
    </group>
  );
}

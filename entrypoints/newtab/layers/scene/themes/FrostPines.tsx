import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { buildSnowPine } from './frostShapes';
import { disposeMesh, makeInstanced, placeAt } from './frostParts';
import { addWind } from './frostWind';
/**
 * The clusters of snowy pines on both sides of the snow, different heights, one instanced mesh (two draw calls with the shadow). They
 * sway gently in the wind, each with its own phase; under reduced motion they stand still.
 */
export function FrostPines({ pines }: { pines: NonNullable<UniqueSceneSpec['frost']>['pines'] }) {
  const mesh = useMemo(
    () =>
      makeInstanced(
        buildSnowPine(),
        addWind(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, emissive: '#0f2546', emissiveIntensity: 0.4 }), 1, 0.035),
        pines.map((p) => placeAt(p.x, 0, p.z, p.rotY, [p.height * 0.95, p.height, p.height * 0.95])),
        'frost-snow-pines',
        { castShadow: true, receiveShadow: true },
      ),
    [pines],
  );
  useEffect(() => () => disposeMesh(mesh), [mesh]);
  return <primitive object={mesh} />;
}

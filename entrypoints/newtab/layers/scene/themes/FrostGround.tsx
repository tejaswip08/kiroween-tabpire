import { useEffect, useMemo } from 'react';
import { CircleGeometry, MeshStandardMaterial } from 'three';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { disposeMesh, makeInstanced, placeAt } from './frostParts';
/** Footprints in the snow, leading along the path toward the chapel: small, soft, bluish ovals only a little darker than the snow. */
function Footprints({ prints }: { prints: FrostPlan['prints'] }) {
  const mesh = useMemo(
    () =>
      makeInstanced(
        new CircleGeometry(0.15, 7).rotateX(-Math.PI / 2),
        new MeshStandardMaterial({ color: '#6f8fbc', roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
        prints.map((p) => placeAt(p.x, 0.045, p.z, p.rotY, [1, 1, 1.7])),
        'frost-footprints',
        { receiveShadow: true },
      ),
    [prints],
  );
  useEffect(() => () => disposeMesh(mesh), [mesh]);
  return <primitive object={mesh} />;
}
/** The ground of the Frozen Cemetery apart from the drifts: the footprints. */
export function FrostGround({ plan }: { plan: FrostPlan }) {
  return <Footprints prints={plan.prints} />;
}

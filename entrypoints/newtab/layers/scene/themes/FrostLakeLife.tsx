import { useEffect, useMemo } from 'react';
import { type BufferGeometry, type Matrix4, Mesh } from 'three';
import { LAKE_Y } from '../../../../../lib/scene/uniqueScenes/frostIce';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { buildHand, buildShards } from './frostShapes';
import { litMaterial, placeAt } from './frostParts';
const moved = (g: BufferGeometry, m: Matrix4): BufferGeometry => g.clone().applyMatrix4(m);
/**
 * The one skeletal hand in the pond (the tab you staked and forgot): it reaches up out of a black hole in the ice, with a ring of ice
 * shards round the edge of the hole. It is still: it stands on the ice, lit by the moon like everything else.
 */
export function FrostLakeLife({ plan }: { plan: FrostPlan }) {
  const parts = useMemo(() => {
    const h = plan.hand;
    const hand = new Mesh(moved(buildHand(), placeAt(h.x, LAKE_Y - 0.3 * h.scale, h.z, h.rotY, h.scale, [-0.08, 0.06])), litMaterial('#2a63a8', 0.55));
    hand.castShadow = true;
    hand.name = 'frost-broken-hand';
    const shards = new Mesh(moved(buildShards(), placeAt(h.x, LAKE_Y + 0.01, h.z, h.rotY, h.scale * 1.1)), litMaterial('#2a63a8', 0.5));
    shards.name = 'frost-ice-shards';
    return { hand, shards };
  }, [plan]);
  useEffect(
    () => () => {
      for (const m of [parts.hand, parts.shards]) {
        m.geometry.dispose();
        (m.material as { dispose(): void }).dispose();
      }
    },
    [parts],
  );
  return (
    <>
      <primitive object={parts.hand} />
      <primitive object={parts.shards} />
    </>
  );
}

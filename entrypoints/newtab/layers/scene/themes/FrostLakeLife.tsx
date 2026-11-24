import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { type BufferGeometry, Color, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAKE_Y } from '../../../../../lib/scene/uniqueScenes/frostIce';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { useDisplay } from '../display';
import { buildHand, buildShards, buildSkull } from './frostShapes';
import { icePulse, litMaterial, placeAt } from './frostParts';
const BONE_TINT = new Color('#b4dcff');
const moved = (g: BufferGeometry, m: Matrix4): BufferGeometry => g.clone().applyMatrix4(m);
/**
 * What lies under the ice of the lake (the tabs you staked and forgot): three skeletal hands and a skull face pressed up against the
 * underside, one merged mesh (one draw call) that glows faintly blue and breathes with the pulse of light under the ice. One more hand has
 * broken through: it reaches up out of a ring of ice shards and a black hole. Under reduced motion the glow stands still.
 */
export function FrostLakeLife({ plan }: { plan: FrostPlan }) {
  const display = useDisplay();
  const parts = useMemo(() => {
    const hand = buildHand();
    const skull = buildSkull();
    const under: BufferGeometry[] = plan.hands.map((h) => moved(hand, placeAt(h.x, 0.12, h.z, h.rotY, h.scale, [-0.5, 0])));
    under.push(moved(skull, placeAt(plan.skull.x, 0.62, plan.skull.z, plan.skull.rotY, plan.skull.scale, [-0.55, 0])));
    const bones = new Mesh(mergeGeometries(under)!, new MeshBasicMaterial({ vertexColors: true }));
    bones.name = 'frost-bones';
    bones.renderOrder = 0;
    const b = plan.broken;
    const reach = new Mesh(moved(hand, placeAt(b.x, LAKE_Y - 0.2 * b.scale, b.z, b.rotY, b.scale * 1.5, [-0.12, 0.08])), litMaterial('#2a63a8', 0.6));
    reach.castShadow = true;
    reach.name = 'frost-broken-hand';
    const shards = new Mesh(moved(buildShards(), placeAt(b.x, LAKE_Y + 0.01, b.z, b.rotY, b.scale * 1.3)), litMaterial('#2a63a8', 0.6));
    shards.name = 'frost-ice-shards';
    return { bones, reach, shards };
  }, [plan]);
  useEffect(
    () => () => {
      for (const m of [parts.bones, parts.reach, parts.shards]) {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      }
    },
    [parts],
  );
  useFrame(() => {
    const k = 0.7 + 0.3 * icePulse(display.time, display.reduced);
    (parts.bones.material as MeshBasicMaterial).color.copy(BONE_TINT).multiplyScalar(k);
  });
  return (
    <>
      <primitive object={parts.bones} />
      <primitive object={parts.reach} />
      <primitive object={parts.shards} />
    </>
  );
}

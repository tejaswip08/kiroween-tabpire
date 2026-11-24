import { useEffect, useMemo } from 'react';
import { DoubleSide, type InstancedMesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import {
  buildBar, buildCandle, buildCross, buildFlameBox, buildFrozenSkeleton, buildIcePillar, buildLanternPost, buildOpenGrave, buildPillarCap, buildRail, buildSlab,
} from './frostShapes';
import { disposeMesh, glowMaterial, litMaterial, makeInstanced, placeAt } from './frostParts';
/**
 * The graveyard of the Frozen Cemetery, every repeat instanced (one draw call per kind):
 * - tilted, snow-capped tombstones in loose rows on both sides of the path (round slabs with a small skull, and crosses);
 * - open graves, dark holes in the snow with a mound of dug-up earth;
 * - iron lanterns on posts along the path, with their flames (the same four are the warm lights);
 * - wax candles on a few graves;
 * - the broken iron fence, half buried (bars and rails);
 * - two blocks of ice, each with a frozen skeleton inside.
 */
export function FrostGraveyard({ plan }: { plan: FrostPlan }) {
  const meshes = useMemo(() => {
    const slab = plan.stones.filter((s) => s.kind === 'slab');
    const cross = plan.stones.filter((s) => s.kind === 'cross');
    const stoneAt = (s: (typeof plan.stones)[number]) => placeAt(s.x, -s.sink, s.z, s.rotY, s.scale, s.tilt);
    const iceMaterial = new MeshStandardMaterial({
      color: '#a8dcff', emissive: '#2a72c0', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.4, depthWrite: false, flatShading: true,
    });
    const skeletonMaterial = new MeshBasicMaterial({ vertexColors: true });
    const all: InstancedMesh[] = [
      makeInstanced(buildSlab(), litMaterial('#14305a', 0.5), slab.map(stoneAt), 'frost-stones-slab', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildCross(), litMaterial('#14305a', 0.5), cross.map(stoneAt), 'frost-stones-cross', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildOpenGrave(), litMaterial('#10264a', 0.4), plan.openGraves.map((g) => placeAt(g.x, 0, g.z, g.rotY)), 'frost-open-graves', { receiveShadow: true }),
      makeInstanced(buildLanternPost(), litMaterial('#10203a', 0.5), plan.lanterns.map((l) => placeAt(l.x, 0, l.z, l.rotY)), 'frost-lanterns', { castShadow: true }),
      makeInstanced(buildFlameBox(), glowMaterial('#ff9a3d', 3.4), plan.lanterns.map((l) => placeAt(l.x, 0, l.z, l.rotY)), 'frost-lantern-flames'),
      makeInstanced(buildCandle(), new MeshBasicMaterial({ color: '#f4efe0' }), plan.candles.map((c) => placeAt(c.x, 0, c.z, 0)), 'frost-candles'),
      makeInstanced(buildBar(), litMaterial('#10203a', 0.5), plan.bars.map((b) => placeAt(b.x, -b.sink, b.z, b.rotY, [1, b.height / 1.7, 1], [0, b.lean])), 'frost-fence-bars', { castShadow: true }),
      makeInstanced(buildRail(), litMaterial('#10203a', 0.5), plan.rails.map((r) => placeAt(r.x, r.y, r.z, r.rotY, [r.length, 1, 1], [0, r.lean])), 'frost-fence-rails', { castShadow: true }),
      makeInstanced(buildFrozenSkeleton(), skeletonMaterial, plan.pillars.map((p) => placeAt(p.x, 0.15, p.z, p.rotY, p.scale * 0.95)), 'frost-pillar-skeletons'),
      makeInstanced(buildPillarCap(), litMaterial('#c8dcf5', 0.7), plan.pillars.map((p) => placeAt(p.x, 0, p.z, p.rotY, p.scale)), 'frost-pillar-caps', { castShadow: true }),
      makeInstanced(buildIcePillar(), iceMaterial, plan.pillars.map((p) => placeAt(p.x, 0, p.z, p.rotY, p.scale)), 'frost-ice-pillars', { renderOrder: 2 }),
    ];
    // The grave floors and the flames are drawn on top of the snow, so they never fight it for the depth.
    (all[2]!.material as MeshStandardMaterial).side = DoubleSide;
    return all;
  }, [plan]);
  useEffect(() => () => meshes.forEach(disposeMesh), [meshes]);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </>
  );
}

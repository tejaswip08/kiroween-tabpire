import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, type InstancedMesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { FrostPlan } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import {
  buildBar, buildCross, buildFlameBox, buildFrozenSkeleton, buildIcePillar, buildLanternHalo, buildLanternPost, buildPillarCap, buildRail, buildSlab,
} from './frostShapes';
import { disposeMesh, litMaterial, makeInstanced, placeAt } from './frostParts';
/**
 * The graveyard, every repeat instanced (one draw call per kind):
 * - neat rows of tilted, snow-capped tombstones on both sides of the path (round slabs with a small skull, and crosses);
 * - five small iron lanterns along the path. The flame is a small box in a plain warm colour and its halo is a faint box no bigger than the
 *   lantern, so nothing blooms into a blob;
 * - the broken iron fence behind the rows, half buried;
 * - an ice block with a frozen skeleton inside it, in the right corner.
 */
export function FrostGraveyard({ plan }: { plan: FrostPlan }) {
  const meshes = useMemo(() => {
    const slab = plan.stones.filter((s) => s.kind === 'slab');
    const cross = plan.stones.filter((s) => s.kind === 'cross');
    const stoneAt = (s: (typeof plan.stones)[number]) => placeAt(s.x, -s.sink, s.z, s.rotY, s.scale, s.tilt);
    const iceMaterial = new MeshStandardMaterial({
      color: '#a8dcff', emissive: '#2a72c0', emissiveIntensity: 0.4, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.4, depthWrite: false, flatShading: true,
    });
    const halo = new MeshBasicMaterial({ color: new Color('#ff9a3d'), transparent: true, opacity: 0.22, depthWrite: false, blending: AdditiveBlending, fog: false });
    const at = plan.lanterns.map((l) => placeAt(l.x, 0, l.z, l.rotY));
    const all: InstancedMesh[] = [
      makeInstanced(buildSlab(), litMaterial('#14305a', 0.4), slab.map(stoneAt), 'frost-stones-slab', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildCross(), litMaterial('#14305a', 0.4), cross.map(stoneAt), 'frost-stones-cross', { castShadow: true, receiveShadow: true }),
      makeInstanced(buildLanternPost(), litMaterial('#10203a', 0.4), at, 'frost-lanterns', { castShadow: true }),
      makeInstanced(buildFlameBox(), new MeshBasicMaterial({ color: '#ffa84d', fog: false }), at, 'frost-lantern-flames'),
      makeInstanced(buildLanternHalo(), halo, at, 'frost-lantern-halos', { renderOrder: 3 }),
      makeInstanced(buildBar(), litMaterial('#10203a', 0.4), plan.bars.map((b) => placeAt(b.x, -b.sink, b.z, b.rotY, [1, b.height / 1.7, 1], [0, b.lean])), 'frost-fence-bars', { castShadow: true }),
      makeInstanced(buildRail(), litMaterial('#10203a', 0.4), plan.rails.map((r) => placeAt(r.x, r.y, r.z, r.rotY, [r.length, 1, 1], [0, r.lean])), 'frost-fence-rails', { castShadow: true }),
      makeInstanced(buildFrozenSkeleton(), new MeshBasicMaterial({ vertexColors: true }), plan.pillars.map((p) => placeAt(p.x, 0.15, p.z, p.rotY, p.scale * 0.95)), 'frost-pillar-skeletons'),
      makeInstanced(buildPillarCap(), litMaterial('#c8dcf5', 0.5), plan.pillars.map((p) => placeAt(p.x, 0, p.z, p.rotY, p.scale)), 'frost-pillar-caps', { castShadow: true }),
      makeInstanced(buildIcePillar(), iceMaterial, plan.pillars.map((p) => placeAt(p.x, 0, p.z, p.rotY, p.scale)), 'frost-ice-pillars', { renderOrder: 2 }),
    ];
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

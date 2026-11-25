import { useEffect, useMemo } from 'react';
import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { buildBackdrop } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import { buildFarPine, buildSmoothMound } from './frostShapes';
import { disposeMesh, makeInstanced, placeAt } from './frostParts';
/**
 * The background layer: a chain of low, soft snowy hills across the whole width, with a dark line of pine silhouettes along their crests.
 * It sits far back and low, so it breaks the horizon without ever rising behind the chips or the search box. Two instanced meshes.
 */
export function FrostBackdrop({ seed }: { seed: number }) {
  const meshes = useMemo(() => {
    const { hills, pines } = buildBackdrop(seed);
    return [
      makeInstanced(
        buildSmoothMound(),
        new MeshStandardMaterial({ color: '#b9cfeb', emissive: '#1d3a66', emissiveIntensity: 0.3, roughness: 1 }),
        hills.map((h) => placeAt(h.x, -0.2, h.z, 0, [h.rx, h.ry, h.rz])),
        'frost-far-hills',
      ),
      makeInstanced(
        buildFarPine(),
        new MeshBasicMaterial({ vertexColors: true }),
        pines.map((p) => placeAt(p.x, p.y, p.z, 0, [(p.scale / 1.9) * 0.85, p.scale / 1.9, (p.scale / 1.9) * 0.85])),
        'frost-far-pines',
      ),
    ];
  }, [seed]);
  useEffect(() => () => meshes.forEach(disposeMesh), [meshes]);
  return (
    <>
      {meshes.map((m) => (
        <primitive key={m.name} object={m} />
      ))}
    </>
  );
}

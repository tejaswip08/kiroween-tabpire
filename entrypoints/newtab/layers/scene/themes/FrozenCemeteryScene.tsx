import { useMemo } from 'react';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { SafeModelBatch } from '../ModelBatch';
import { FrozenLake } from './FrozenLake';
import { Icicles } from './Icicles';
import { SnowMounds } from './SnowMounds';
import { ThemeGround } from './ThemeGround';
/**
 * The Frozen Cemetery: pale snow ground, the frozen lake with tilted gravestones stuck in it and icicles under their tops,
 * frosted pines and ice boulders (every model instanced, one batch per model) and snow mounds. There is no path.
 */
export function FrozenCemeteryScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const ice = spec.ice;
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      <FrozenLake />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} />
      ))}
      {ice && <Icicles icicles={ice.icicles} />}
      {ice && <SnowMounds mounds={ice.mounds} />}
    </>
  );
}

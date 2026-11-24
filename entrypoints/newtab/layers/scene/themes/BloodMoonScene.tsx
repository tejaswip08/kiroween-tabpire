import { useMemo } from 'react';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { SafeModelBatch } from '../ModelBatch';
import { LavaCracks } from './LavaCracks';
import { StonePlatform } from './StonePlatform';
import { ThemeGround } from './ThemeGround';

/**
 * The Blood Moon: cracked dark red ground with glowing lava cracks, the ruins on their stepped stone platform, the ring of
 * columns around the pedestal and a few dead trees (every model instanced, one batch per model). There is no path.
 */
export function BloodMoonScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const blood = spec.blood;
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      {blood && <LavaCracks cracks={blood.cracks} />}
      {blood && <StonePlatform steps={blood.platform} />}
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} />
      ))}
    </>
  );
}

import { useMemo } from 'react';
import { SCARECROW } from '../../../../../lib/scene/uniqueScenes/pumpkin';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { ModelBoundary, SafeModelBatch } from '../ModelBatch';
import { AutumnLane } from './AutumnLane';
import { Scarecrow } from './Scarecrow';
import { ThemeGround } from './ThemeGround';
import { ThemePath } from './ThemePath';
import { Windmill } from './Windmill';

/**
 * The Pumpkin Patch: a farm at dusk. Earth ground and a dirt track, the barn with its silo and windmill, corn, hay, fence,
 * pumpkins and jack-o'-lanterns (every model instanced, one batch per model), and the scarecrow. The windmill's sails turn.
 * The autumn lane (`AutumnLane`) adds the big old tree, the trick-or-treaters, dry corn, a crooked fence, grass banks and leaves.
 */
export function PumpkinPatchScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(
    () => spec.models.filter((id) => id !== 'farm_windmill').map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })),
    [spec],
  );
  const windmill = useMemo(() => spec.placements.find((p) => p.model === 'farm_windmill'), [spec]);
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      <ThemePath path={spec.path} />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} />
      ))}
      {windmill && (
        <ModelBoundary id="farm_windmill">
          <Windmill placement={windmill} />
        </ModelBoundary>
      )}
      {spec.autumn && <AutumnLane plan={spec.autumn} />}
      <Scarecrow x={SCARECROW.x} z={SCARECROW.z} rotY={SCARECROW.rotY} scale={SCARECROW.scale} />
    </>
  );
}

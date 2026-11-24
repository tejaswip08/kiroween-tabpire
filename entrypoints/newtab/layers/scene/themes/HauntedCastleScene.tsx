import { useMemo } from 'react';
import { isSwayModel } from '../../../../../lib/scene/uniqueScenes/castleParts';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { ModelBoundary, SafeModelBatch } from '../ModelBatch';
import { CastleWindows } from './CastleWindows';
import { SwayBatch, useSwayClock } from './SwayBatch';
import { ThemeGround } from './ThemeGround';
import { ThemePath } from './ThemePath';
/**
 * The Haunted Castle: flagstone ground and a straight flagstone path to the door, the fortress with its courtyard wall, the torches
 * along the path, and the lit windows. Every model is instanced, one batch per model; the banners and wall flags are batches whose
 * cloth sways in the vertex shader. The sky's lightning is drawn by the shared `SkyFeatures`.
 */
export function HauntedCastleScene({ spec }: { spec: UniqueSceneSpec }) {
  const clock = useSwayClock();
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      <ThemePath path={spec.path} />
      {groups.map((g) =>
        isSwayModel(g.id) ? (
          <ModelBoundary key={g.id} id={g.id}>
            <SwayBatch id={g.id} placements={g.placements} clock={clock} />
          </ModelBoundary>
        ) : (
          <SafeModelBatch key={g.id} id={g.id} placements={g.placements} />
        ),
      )}
      {spec.castle && <CastleWindows quads={spec.castle.windows} />}
    </>
  );
}

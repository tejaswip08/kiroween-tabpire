import { useMemo } from 'react';
import { FROST_TREE_LOOK } from '../../../../../lib/scene/uniqueScenes/frost';
import { RIDGE_MOUND } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { SafeModelBatch } from '../ModelBatch';
import { FrostBackdrop } from './FrostBackdrop';
import { FrostChapel } from './FrostChapel';
import { FrostCreatures } from './FrostCreatures';
import { FrostGraveyard } from './FrostGraveyard';
import { FrostGround } from './FrostGround';
import { FrostLakeLife } from './FrostLakeLife';
import { FrozenLake } from './FrozenLake';
import { Icicles } from './Icicles';
import { SnowMounds } from './SnowMounds';
import { ThemeGround } from './ThemeGround';
import { ThemePath } from './ThemePath';
/**
 * The Frozen Cemetery: a simple picture in layers. Far back, snowy hills with a line of pine silhouettes. In the midground the small ruined
 * chapel (right, its doorway glowing icy blue) and the round frozen pond with one hand reaching up through the ice (left). A snowy path with
 * footprints, iron lanterns and neat rows of tombstones leads from the bottom centre to the chapel. The corners hold a big pine and an owl
 * (left), a bare tree with two crows and a block of ice with a frozen skeleton (right). Everything repeated is instanced; reduced motion
 * stills the howl, the pond glow, the doorway glow and the owl.
 */
export function FrozenCemeteryScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const frost = spec.frost;
  const drifts = useMemo(() => [...(frost?.drifts ?? []), RIDGE_MOUND], [frost]);
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      <ThemePath path={spec.path} />
      <FrostBackdrop seed={spec.seed} />
      <FrozenLake plan={frost?.plan} />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} look={g.id === 'tree_dead_large' ? FROST_TREE_LOOK : undefined} />
      ))}
      <SnowMounds mounds={drifts} />
      {frost && (
        <>
          <Icicles icicles={frost.plan.stoneIcicles} name="tombstone-icicles" />
          <FrostChapel icicles={frost.plan.chapelIcicles} />
          <FrostGraveyard plan={frost.plan} />
          <FrostLakeLife plan={frost.plan} />
          <FrostCreatures plan={frost.plan} attached={frost.attached} />
          <FrostGround plan={frost.plan} />
        </>
      )}
    </>
  );
}

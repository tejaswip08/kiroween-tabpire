import { useMemo } from 'react';
import { FROST_TREE_LOOK } from '../../../../../lib/scene/uniqueScenes/frost';
import { RIDGE_MOUND } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { SafeModelBatch } from '../ModelBatch';
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
 * The Frozen Cemetery at night. At the end of a snowy path (with footprints in it) stands the ruined chapel, half buried in snow, its
 * doorway glowing faint icy blue. A frozen lake with bones under its ice lies beside the path; tilted, snow-capped tombstones, open graves,
 * iron lanterns, two blocks of ice with frozen skeletons and a broken fence fill the snow; bare dead trees (tinted frosty) carry icicles, a
 * lantern and crows; frosted pines and small ice boulders stand heavy at the sides; wolves watch from a far ridge. Every repeat is
 * instanced (one batch per model, one instanced mesh per kind); reduced motion stills the waves, the pulses and the gusts.
 */
export function FrozenCemeteryScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const ice = spec.ice;
  const frost = spec.frost;
  const drifts = useMemo(() => [...(ice?.mounds ?? []), ...(frost?.plan.drifts ?? []), RIDGE_MOUND], [ice, frost]);
  return (
    <>
      <ThemeGround kind={spec.ground.kind} />
      <ThemePath path={spec.path} />
      <FrozenLake plan={frost?.plan} />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} look={g.id === 'tree_dead_large' ? FROST_TREE_LOOK : undefined} />
      ))}
      {ice && <Icicles icicles={ice.icicles} />}
      <SnowMounds mounds={drifts} />
      {frost && (
        <>
          <FrostChapel icicles={frost.plan.chapelIcicles} />
          <FrostGraveyard plan={frost.plan} />
          <FrostLakeLife plan={frost.plan} />
          <FrostCreatures plan={frost.plan} attached={frost.attached} ghostSpots={spec.ghostSpots} ghostTint={spec.layers.ghostTint ?? '#9fd8ff'} />
          <FrostGround plan={frost.plan} attached={frost.attached} />
        </>
      )}
    </>
  );
}

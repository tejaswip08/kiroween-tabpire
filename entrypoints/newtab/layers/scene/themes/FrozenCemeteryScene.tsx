import { useMemo } from 'react';
import { FROST_TREE_LOOK } from '../../../../../lib/scene/uniqueScenes/frost';
import { RIDGE_MOUND } from '../../../../../lib/scene/uniqueScenes/frostPlan';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { SafeModelBatch, type ModelSway } from '../ModelBatch';
import { FrostBackdrop } from './FrostBackdrop';
import { FrostCreatures } from './FrostCreatures';
import { FrostGale } from './FrostGale';
import { FrostGraveyard } from './FrostGraveyard';
import { FrostGround } from './FrostGround';
import { FrostHouse } from './FrostHouse';
import { FrostLakeLife } from './FrostLakeLife';
import { FrostPines } from './FrostPines';
import { FrostProps } from './FrostProps';
import { FrozenLake } from './FrozenLake';
import { Icicles } from './Icicles';
import { SnowMounds } from './SnowMounds';
import { ThemeGround } from './ThemeGround';
import { ThemePath } from './ThemePath';
/** How much the pines and the bare tree sway: the top moves this share of the tree's height (the pines bend more than the stiff bare tree). */
const SWAY: Record<string, ModelSway> = { frost_pine_a: { strength: 0.035 }, tree_dead_large: { strength: 0.02 } };
/**
 * The Frozen Cemetery: a simple picture in layers, in a cold wind. Far back, snowy hills with a line of pine silhouettes and two faded
 * ruined cottages. In the midground the haunted house (right of the middle: a sagging snowy roof, icicles, boarded windows with a faint
 * flickering light, a leaning chimney with smoke, a tattered flag, a broken gate) and the round frozen pond with one hand reaching up
 * through the ice (left). A snowy path with footprints, hanging lanterns and a few tombstones leads from the bottom centre to the house.
 * The corners hold a big pine and a tombstone (left) and a bare tree with two crows (right). Clusters of pines, bare trees with icicles
 * and the scary things (a stone angel, an open grave, coffins, bones, a well, a cart, stumps, logs, gates) fill the snow. The trees sway, the lanterns swing, the
 * flag flaps, snow and spindrift blow sideways and a thin mist rolls over the snow. Everything repeated is instanced; reduced motion
 * stills all of it.
 */
export function FrozenCemeteryScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const frost = spec.frost;
  const drifts = useMemo(() => [...(frost?.drifts ?? []), RIDGE_MOUND], [frost]);
  return (
    <>
      <FrostGale />
      <ThemeGround kind={spec.ground.kind} />
      <ThemePath path={spec.path} />
      <FrostBackdrop seed={spec.seed} />
      <FrozenLake plan={frost?.plan} />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} look={g.id === 'tree_dead_large' ? FROST_TREE_LOOK : undefined} sway={SWAY[g.id]} />
      ))}
      <SnowMounds mounds={drifts} />
      {frost && (
        <>
          <Icicles icicles={frost.plan.stoneIcicles} name="tombstone-icicles" />
          <FrostHouse plan={frost.plan} />
          <FrostGraveyard plan={frost.plan} />
          <FrostProps plan={frost.plan} />
          <FrostPines pines={frost.pines} />
          <FrostLakeLife plan={frost.plan} />
          <FrostCreatures plan={frost.plan} attached={frost.attached} />
          <FrostGround plan={frost.plan} />
        </>
      )}
    </>
  );
}

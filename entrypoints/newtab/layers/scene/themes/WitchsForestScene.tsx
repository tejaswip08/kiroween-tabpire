import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { flicker } from '../../../../../lib/scene/flicker';
import { cauldronFxAt } from '../../../../../lib/scene/uniqueScenes/forest';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import { CauldronFx } from '../CauldronFx';
import { useDisplay } from '../display';
import { SafeModelBatch, faceGlowLevel, type ModelLook } from '../ModelBatch';
import { useSceneTheme } from '../themeColors';
import { ForestTrees } from './ForestTrees';
import { ForestFire } from './ForestFire';
import { ForestFloor } from './ForestFloor';
import { ForestGhosts } from './ForestGhosts';
import { ForestHouse } from './ForestHouse';
import { ForestMidground } from './ForestMidground';
import { ForestScarecrows } from './ForestScarecrows';
/**
 * The trees are drawn as near-black silhouettes: only the bark mesh of each file (no leaf clumps), multiplied by a very dark
 * colour, so what shows is the warm red-orange light from the left and the green light from the right.
 */
const BARK = '#4a3a36';
const TREE_LOOK: Record<string, ModelLook> = {
  forest_twisted_a: { only: ['TwistedTree_2_1'], color: BARK },
  forest_twisted_b: { only: ['TwistedTree_1_1'], color: BARK },
  forest_twisted_c: { only: ['TwistedTree_3_1'], color: BARK },
  // Mossy rocks: the grey stone multiplied by a dull green.
  forest_rock_large: { color: '#7f9a74' },
  forest_rocks: { color: '#7f9a74' },
  // The carved face reads orange: the texture is darkened a little so the fire light and the glow do not blow it out white.
  // The eyes and mouth glow warm orange-yellow from inside, with a soft flicker (`JackFlicker`).
  pumpkin_orange_jackolantern: { color: '#c98a52', faceGlow: '#ffb02e' },
};
/** Writes the soft candle flicker of the glowing jack-o'-lantern faces (held still with reduced motion). */
function JackFlicker() {
  const display = useDisplay();
  useFrame(() => {
    faceGlowLevel.value = 2.2 * flicker(display.time, 3.1, display.reduced);
  });
  return null;
}
/** Two lights from the sides with no shadows: hot red-orange from the left (the fire) and eerie green from the right. */
function SideLights() {
  const { colors } = useSceneTheme();
  return (
    <>
      <directionalLight position={[-34, 9, -8]} color={colors.skyLeft ?? '#ff5a1c'} intensity={4} />
      <directionalLight position={[34, 9, -8]} color={colors.skyRight ?? '#35e08a'} intensity={3} />
    </>
  );
}
/**
 * The Witch's Forest: near-black gnarled trees in three layers of depth (instanced, bark only) closing over a winding dirt
 * path, the haunted tree with its glowing face, the fire and the big jack-o'-lantern at its foot, scarecrows, green ghosts,
 * crooked crosses, and a small cauldron with a few glowing mushrooms. Nothing stands on the middle of the path. At the end of the
 * path stands the witch's cottage, in front of a pale moon, with far layers of small trees, stumps, mossy rocks, rolling bumps
 * and thick ground fog filling the middle and the back.
 */
export function WitchsForestScene({ spec }: { spec: UniqueSceneSpec }) {
  const groups = useMemo(() => spec.models.map((id) => ({ id, placements: spec.placements.filter((p) => p.model === id) })), [spec]);
  const parts = spec.forest!;
  const pot = useMemo(() => spec.placements.find((p) => p.model === 'forest_cauldron')!, [spec]);
  const liquid = useMemo(() => cauldronFxAt(pot), [pot]);
  const allLogs = useMemo(() => [...parts.logs, ...parts.mid.logs], [parts]);
  const allGraves = useMemo(() => [...parts.moreGraves, ...parts.mid.graves], [parts]);
  return (
    <>
      <SideLights />
      <JackFlicker />
      <ForestFloor path={spec.path} graves={parts.graves} grass={parts.grass} />
      {groups.map((g) => (
        <SafeModelBatch key={g.id} id={g.id} placements={g.placements} look={TREE_LOOK[g.id]} />
      ))}
      <ForestTrees scary={parts.scary} thorns={parts.thorns} logs={allLogs} graves={allGraves} />
      <ForestMidground mid={parts.mid} />
      <ForestHouse />
      <ForestFire x={parts.fire.x} z={parts.fire.z} flames={parts.fire.flames} sparks={parts.fire.sparks} />
      <ForestScarecrows spots={parts.scarecrows} />
      <ForestGhosts ghosts={parts.ghosts} wisp={parts.wisp} />
      <CauldronFx at={liquid} />
    </>
  );
}

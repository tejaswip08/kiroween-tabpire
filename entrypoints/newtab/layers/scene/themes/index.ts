// The scene component of each unique theme, by theme id. A theme that is not listed here keeps the Crypt-based scene.
import type { ComponentType } from 'react';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import type { ThemeId } from '../../../../../lib/themes';
import { BloodMoonScene } from './BloodMoonScene';
import { FrozenCemeteryScene } from './FrozenCemeteryScene';
import { HauntedCastleScene } from './HauntedCastleScene';
import { PumpkinPatchScene } from './PumpkinPatchScene';
import { WitchsForestScene } from './WitchsForestScene';

export type ThemeSceneComponent = ComponentType<{ spec: UniqueSceneSpec }>;

export const THEME_SCENES: Partial<Record<ThemeId, ThemeSceneComponent>> = {
  pumpkin: PumpkinPatchScene,
  forest: WitchsForestScene,
  frost: FrozenCemeteryScene,
  bloodmoon: BloodMoonScene,
  castle: HauntedCastleScene,
};

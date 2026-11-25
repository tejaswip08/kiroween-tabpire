// The scene component of each ENABLED unique theme, by theme id. A theme that is not listed here keeps the Crypt-based scene.
// The disabled themes (Blood Moon, Haunted Castle) are left out, so their components (BloodMoonScene.tsx, HauntedCastleScene.tsx)
// stay in the repository but out of the bundle.
import type { ComponentType } from 'react';
import type { UniqueSceneSpec } from '../../../../../lib/scene/uniqueScenes/types';
import type { ThemeId } from '../../../../../lib/themes';
import { FrozenCemeteryScene } from './FrozenCemeteryScene';
import { PumpkinPatchScene } from './PumpkinPatchScene';
import { WitchsForestScene } from './WitchsForestScene';

export type ThemeSceneComponent = ComponentType<{ spec: UniqueSceneSpec }>;

export const THEME_SCENES: Partial<Record<ThemeId, ThemeSceneComponent>> = {
  pumpkin: PumpkinPatchScene,
  forest: WitchsForestScene,
  frost: FrozenCemeteryScene,
};

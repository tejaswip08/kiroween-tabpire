// Every ENABLED unique theme scene, by theme id. The disabled themes (Blood Moon, Haunted Castle: `DISABLED_THEMES`) are not listed,
// so their builders are not imported here and stay out of the app's bundle. Their code is still in `bloodmoon.ts` and `castle.ts`.
// Every unique theme scene, by theme id. A theme that is listed here gets its own scene (its layout, models, anchors and
// weather come from its spec); a theme that is not listed keeps the Crypt-based layout until it is moved.
import type { ThemeId } from '../../themes';
import { buildFrozenCemetery } from './frost';
import { buildWitchsForest } from './forest';
import { buildPumpkinPatch } from './pumpkin';
import type { UniqueSceneBuilder } from './types';

export const UNIQUE_SCENES: Partial<Record<ThemeId, UniqueSceneBuilder>> = {
  pumpkin: buildPumpkinPatch,
  forest: buildWitchsForest,
  frost: buildFrozenCemetery,
};

export const isUniqueTheme = (id: ThemeId): boolean => UNIQUE_SCENES[id] !== undefined;

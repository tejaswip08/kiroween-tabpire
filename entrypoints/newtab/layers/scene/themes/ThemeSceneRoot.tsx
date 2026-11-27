import { themeScene } from '../../../../../lib/scene/themeLayout';
import type { ThemeId } from '../../../../../lib/themes';
import { Bats } from '../Bats';
import { Clouds } from '../Clouds';
import { Effects } from '../Effects';
import { Embers } from '../Embers';
import { FillProps } from '../Fill';
import { Fog } from '../Fog';
import { Ghosts } from '../Ghosts';
import { Glows } from '../Glows';
import { Lights } from '../Lights';
import { Mist } from '../Mist';
import { Moon } from '../Moon';
import { FROST_BLOOM } from '../../../../../lib/scene/uniqueScenes/frost';
import { FOREST_MOON_DEPTH } from '../../../../../lib/scene/uniqueScenes/forest';
import { Sky } from '../Sky';
import { SceneWeather } from '../Weather';
import { Witch } from '../Witch';
import { THEME_SCENES } from './index';
import { SkyFeatures } from './SkyFeatures';

/**
 * The scene of a unique theme: the shared building blocks (sky, moon, clouds, witch, bats, ghosts, fog, lights, glows, mist,
 * embers, weather and post effects), turned on and configured by the theme's spec, plus the theme's own scene component.
 * It never draws the Crypt's graveyard, far village or critters. The Moon aim is set by `ThemedScene`.
 */
export function ThemeSceneRoot({ id }: { id: ThemeId }) {
  const spec = themeScene(id).unique;
  const Scene = THEME_SCENES[id];
  if (!spec || !Scene) return null;
  const { layers } = spec;
  return (
    <>
      <Sky />
      {layers.moon !== false && <Moon behind={id === 'forest' ? FOREST_MOON_DEPTH : undefined} />}
      <SkyFeatures features={spec.sky} lightningSeed={spec.castle?.lightningSeed} />
      {layers.clouds && <Clouds />}
      {layers.witch && <Witch />}
      {layers.bats > 0 && <Bats boost={layers.bats} />}
      {layers.ghosts && <Ghosts tint={layers.ghostTint} wind={layers.ghostWind} />}
      <Fog />
      <Lights />
      <Scene spec={spec} />
      <FillProps />
      <Glows />
      {layers.mist && <Mist />}
      {layers.embers && <Embers />}
      <SceneWeather />
      <Effects bloom={id === 'frost' ? FROST_BLOOM : undefined} />
    </>
  );
}

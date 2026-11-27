import { Fog } from './Fog';
import { Cat } from './Cat';
import { CauldronFx } from './CauldronFx';
import { Crows } from './Crows';
import { DepthFog } from './DepthFog';
import { FarVillage } from './FarVillage';
import { HorizonClouds } from './HorizonClouds';
import { OpenCoffin } from './OpenCoffin';
import { Owl } from './Owl';
import { Skeletons } from './Skeletons';
import { Cobwebs, Spiders } from './Spiders';
import { Wisps } from './Wisps';
import { Bats } from './Bats';
import { Clouds } from './Clouds';
import { Effects } from './Effects';
import { FillProps } from './Fill';
import { Props } from './Props';
import { Embers } from './Embers';
import { SceneWeather } from './Weather';
import { Ghosts } from './Ghosts';
import { Glows } from './Glows';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { Mist } from './Mist';
import { Moon } from './Moon';
import { Sky } from './Sky';
import { Witch } from './Witch';

export { Fog };

/** Everything drawn in the scene. */
export function SceneContents() {
  return (
    <>
      <Sky />
      <Moon />
      <Clouds />
      <Witch />
      <Bats />
      <Ghosts />
      <Fog />
      <Lights />
      <Ground />
      <FarVillage />
      <HorizonClouds />
      <Props />
      <FillProps />
      <Cat />
      <Crows />
      <Owl />
      <Spiders />
      <Cobwebs />
      <Wisps />
      <Skeletons />
      <CauldronFx />
      <OpenCoffin />
      <Glows />
      <Mist />
      <DepthFog />
      <Embers />
      <SceneWeather />
      <Effects />
    </>
  );
}

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { FogExp2 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { Cat } from './Cat';
import { CauldronFx } from './CauldronFx';
import { Crows } from './Crows';
import { FarVillage } from './FarVillage';
import { LowClouds } from './LowClouds';
import { OpenCoffin } from './OpenCoffin';
import { Owl } from './Owl';
import { Skeletons } from './Skeletons';
import { Cobwebs, Spiders } from './Spiders';
import { Wisps } from './Wisps';
import { Bats } from './Bats';
import { Clouds } from './Clouds';
import { Effects } from './Effects';
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
import { useColorSync } from './themeColors';

/** Depth fog in the cold fog colour. Its density follows the estimated memory in use (70 to 130 percent). */
export function Fog() {
  const display = useDisplay();
  const fog = useMemo(() => new FogExp2(sceneColorsFor('crypt').fog.clone(), LOOK.fogDensity), []);
  useColorSync((c) => {
    fog.color.copy(c.fog);
  });
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  useFrame(() => {
    fog.density = LOOK.fogDensity * display.fogFactor;
  });
  return null;
}

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
      <LowClouds />
      <Props />
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
      <Embers />
      <SceneWeather />
      <Effects />
    </>
  );
}

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { FogExp2 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { C } from './colors';
import { useDisplay } from './display';
import { Bats } from './Bats';
import { Clouds } from './Clouds';
import { Effects } from './Effects';
import { Props } from './Props';
import { Embers } from './Embers';
import { Ghosts } from './Ghosts';
import { Glows } from './Glows';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { Mist } from './Mist';
import { Moon } from './Moon';
import { Sky } from './Sky';
import { Witch } from './Witch';

/** Depth fog in the cold fog colour. Its density follows the estimated memory in use (70 to 130 percent). */
function Fog() {
  const display = useDisplay();
  const fog = useMemo(() => new FogExp2(C.fog, LOOK.fogDensity), []);
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
      <Props />
      <Glows />
      <Mist />
      <Embers />
      <Effects />
    </>
  );
}

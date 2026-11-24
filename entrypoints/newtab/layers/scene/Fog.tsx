import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { FogExp2 } from 'three';
import { LOOK } from '../../../../lib/scene/config';
import { sceneColorsFor } from './colors';
import { useDisplay } from './display';
import { useColorSync, useSceneTheme } from './themeColors';

/** Depth fog in the cold fog colour. Its density follows the estimated memory in use (70 to 130 percent). */
export function Fog() {
  const display = useDisplay();
  // A unique theme may ask for a denser fog (Witch's Forest). The Crypt and the other themes keep 1.
  const scale = useSceneTheme().scene.unique?.fogScale ?? 1;
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
    fog.density = LOOK.fogDensity * scale * display.fogFactor;
  });
  return null;
}

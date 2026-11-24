import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type DirectionalLight, type HemisphereLight, Object3D, type PointLight } from 'three';
import { BUDGET, LOOK, QUALITY } from '../../../../lib/scene/config';
import { flicker } from '../../../../lib/scene/flicker';
import { FLASH_BOOST } from '../../../../lib/scene/lightning';
import type { SceneColors } from './colors';
import { useDisplay } from './display';
import { useSceneTheme } from './themeColors';

const TARGET = { x: 0, y: 0, z: -14 };
const colorFor = (kind: string, c: SceneColors) =>
  kind === 'jackOLantern' ? c.jack : kind === 'cryptDoor' ? c.door : kind === 'candle' ? c.candle : kind === 'cauldron' ? c.cauldron : c.lantern;

/**
 * Cold light from the moon with shadows, a cold hemisphere fill and a cold rim light, against at
 * most six warm flickering point lights at the crypt doorway, the lanterns and the jack-o'-lanterns.
 */
export function Lights() {
  const display = useDisplay();
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const lastFlash = useRef(0);
  const rim = useRef<DirectionalLight>(null);
  const points = useRef<(PointLight | null)[]>([]);
  const target = useMemo(() => {
    const t = new Object3D();
    t.position.set(TARGET.x, TARGET.y, TARGET.z);
    return t;
  }, []);
  const { scene, colors } = useSceneTheme();
  const lights = useMemo(() => scene.layout.lights.slice(0, BUDGET.maxPointLights), [scene.layout.lights]);
  const size = QUALITY.shadowMapSize;

  useFrame(() => {
    const m = display.moon;
    sun.current?.position.set(TARGET.x + m.x * LOOK.moonlight.distance, TARGET.y + m.y * LOOK.moonlight.distance, TARGET.z + m.z * LOOK.moonlight.distance);
    // The rim light shines from behind the props toward the camera.
    rim.current?.position.set(TARGET.x - m.x * 30 + 10, 14, TARGET.z - 40);
    // Lightning (the castle): a brief boost of the hemisphere and moonlight. Nothing is written while the flash is 0, as in every other theme.
    const flash = display.flash ?? 0;
    if (flash !== lastFlash.current) {
      lastFlash.current = flash;
      if (hemi.current) hemi.current.intensity = LOOK.hemisphere.intensity * (1 + FLASH_BOOST.hemisphere * flash);
      if (sun.current) sun.current.intensity = LOOK.moonlight.intensity * (1 + FLASH_BOOST.moonlight * flash);
    }
    for (let i = 0; i < lights.length; i++) {
      const l = points.current[i];
      if (l) l.intensity = LOOK.warmLight.intensity * flicker(display.time, i + 1, display.reduced);
    }
  });

  return (
    <>
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={[colors.hemiSky, colors.hemiGround, LOOK.hemisphere.intensity]} />
      <directionalLight
        ref={sun}
        color={colors.moonlight}
        intensity={LOOK.moonlight.intensity}
        target={target}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={5}
        shadow-camera-far={190}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* Purple fill from the camera's side, no shadows: lights the faces of everything toward us. */}
      <directionalLight position={[-8, 14, 30]} color={colors.hemiSky} intensity={LOOK.fill.intensity} target={target} />
      <directionalLight ref={rim} color={colors.rim} intensity={LOOK.rim.intensity} target={target} />
      {lights.map((l, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            points.current[i] = el;
          }}
          position={[l.x, l.y + 0.4, l.z]}
          color={colorFor(l.kind, colors)}
          intensity={LOOK.warmLight.intensity}
          distance={LOOK.warmLight.distance}
          decay={LOOK.warmLight.decay}
        />
      ))}
    </>
  );
}

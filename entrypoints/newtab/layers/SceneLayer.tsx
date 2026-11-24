import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { BASE_FOV, CAMERA_REST } from '../../../lib/scene/camera';
import { QUALITY } from '../../../lib/scene/config';
import { sceneState, type SceneInputs } from '../../../lib/scene/meaning';
import type { ThemeId } from '../../../lib/themes';
import { usePageVisible, useReducedMotion } from './motion';
import { usePointerTracker } from './pointer';
import { CameraRig } from './scene/CameraRig';
import { createDisplay, DisplayContext } from './scene/display';
import { SceneDriver } from './scene/Driver';
import { FrameStats } from './scene/FrameStats';
import { useThemePreload } from './scene/preloadThemes';
import { ShadowTicker } from './scene/ShadowTicker';
import { ThemedScene } from './scene/ThemedScene';
import { reportContextLost, reportContextRestored, useWebgl } from './useWebgl';

/** Tells the page the scene has drawn, so the canvas can fade in over the gradient. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    // Wait two frames, so the first picture exists before the fade starts.
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(onReady);
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [onReady]);
  return null;
}

/**
 * The night graveyard canvas. Pixel ratio 1, no antialiasing and the soft shadow filter,
 * as set in lib/scene/config.ts. It stops drawing while the page is hidden. With reduced
 * motion it draws only when something changes.
 */
export default function SceneLayer({ inputs, themeId }: { inputs: SceneInputs; themeId: ThemeId }) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const { lost } = useWebgl();
  usePointerTracker();
  const [ready, setReady] = useState(false);
  useThemePreload(ready, themeId);
  const display = useMemo(() => createDisplay(sceneState(inputs), reduced), []); // eslint-disable-line react-hooks/exhaustive-deps
  display.reduced = reduced;
  const frameloop = !visible || lost ? 'never' : reduced ? 'demand' : 'always';

  return (
    <Canvas
      className="scene-canvas"
      data-ready={ready ? 'true' : 'false'}
      dpr={QUALITY.sceneDpr}
      gl={{ antialias: QUALITY.sceneAntialias, stencil: false, powerPreference: 'high-performance', alpha: false }}
      shadows="percentage"
      flat
      frameloop={frameloop}
      camera={{ fov: BASE_FOV, near: 0.5, far: 600, position: [...CAMERA_REST.position] }}
      onCreated={({ gl }) => {
        const el = gl.domElement;
        el.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          reportContextLost();
        });
        el.addEventListener('webglcontextrestored', () => reportContextRestored());
      }}
    >
      <DisplayContext.Provider value={display}>
        <SceneDriver inputs={inputs} display={display} />
        <CameraRig display={display} />
        <ShadowTicker display={display} />
        <FrameStats />
        <Suspense fallback={null}>
          <ThemedScene themeId={themeId} />
          <ReadySignal onReady={() => setReady(true)} />
        </Suspense>
      </DisplayContext.Provider>
    </Canvas>
  );
}

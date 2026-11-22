import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { QUALITY } from '../../../lib/scene/config';
import { usePageVisible, useReducedMotion } from './motion';
import { useCursorTracker } from './portraits/cursor';
import { PortraitView } from './portraits/PortraitView';
import { useCardSlots } from './portraits/useCardSlots';
import { fpsStore } from './fpsStore';
import { clearPortraitsReady } from './portraitReady';
import { reportContextLost, reportContextRestored, useWebgl } from './useWebgl';

/** Feeds the #fps readout with the draw calls and triangles of all views in one frame. */
function PortraitStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.info.autoReset = false;
  }, [gl]);
  useFrame(() => gl.info.reset(), -1000);
  useFrame((_, dt) => fpsStore.record('portrait', performance.now(), dt * 1000, gl.info.render.calls, gl.info.render.triangles), 1000);
  return null;
}

/** With reduced motion the canvas draws only on demand, so it must redraw when the page scrolls or resizes. */
function RedrawOnScroll() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const go = () => invalidate();
    window.addEventListener('scroll', go, { passive: true, capture: true });
    window.addEventListener('resize', go);
    return () => {
      window.removeEventListener('scroll', go, true);
      window.removeEventListener('resize', go);
    };
  }, [invalidate]);
  return null;
}

/**
 * The one shared canvas that draws every card's vampire, using one drei View per card. It sits
 * below the cards; each card has a hole where its View shows. Views that are far off screen are
 * not mounted, and drei skips drawing the ones that are just off it.
 */
export default function PortraitLayer() {
  const slots = useCardSlots();
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const { lost } = useWebgl();
  useCursorTracker();
  useEffect(() => clearPortraitsReady, []);

  return (
    <Canvas
      className="portrait-canvas"
      dpr={[1, QUALITY.portraitDprMax]}
      gl={{ antialias: QUALITY.portraitAntialias, alpha: true, powerPreference: 'high-performance' }}
      frameloop={!visible || lost ? 'never' : reduced ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        const el = gl.domElement;
        el.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          reportContextLost();
        });
        el.addEventListener('webglcontextrestored', () => reportContextRestored());
      }}
    >
      <PortraitStats />
      {reduced && <RedrawOnScroll />}
      {slots.map((s) => (
        <PortraitView key={s.id} slot={s} />
      ))}
    </Canvas>
  );
}

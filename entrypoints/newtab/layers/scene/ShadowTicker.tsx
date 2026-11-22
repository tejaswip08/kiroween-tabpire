import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { QUALITY } from '../../../../lib/scene/config';
import type { SceneDisplay } from './display';

/**
 * The shadow map is redrawn every 20 frames, not every frame, and at once when props
 * change. Only static props cast shadows, so the picture does not need more.
 */
export function ShadowTicker({ display }: { display: SceneDisplay }) {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  useFrame(() => {
    frame.current++;
    if (display.shadowDirty || frame.current % QUALITY.shadowRefreshFrames === 0) {
      gl.shadowMap.needsUpdate = true;
      display.shadowDirty = false;
    }
  }, -1);
  return null;
}

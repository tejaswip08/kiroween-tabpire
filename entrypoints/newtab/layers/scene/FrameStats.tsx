import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { fpsStore } from '../fpsStore';

/** Feeds the #fps readout: frame time, draw calls and triangles of the whole frame. */
export function FrameStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // Count the whole frame (shadow pass and post-processing included), not each render call.
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame(() => gl.info.reset(), -1000);
  useFrame((_, dt) => {
    fpsStore.record('scene', performance.now(), dt * 1000, gl.info.render.calls, gl.info.render.triangles);
  }, 1000);
  return null;
}

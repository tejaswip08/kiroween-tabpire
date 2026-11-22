import { useFrame } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { FRAME } from '../../../../lib/vampire/rig';
import type { PortraitRef } from './shared';

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Frames the standing vampire from the chest up, filling most of the arch, or pulls back and looks down
 * into the coffin as the vampire lies down.
 */
export function ViewCamera({ state }: { state: PortraitRef }) {
  useFrame(({ camera }) => {
    const k = Math.min(1, Math.max(state.current?.pose.lying ?? 0, state.current?.exit?.coffin ?? 0));
    const cam = camera as PerspectiveCamera;
    cam.position.set(0, lerp(FRAME.centreY, 1.05, k), lerp(FRAME.distance, 1.75, k));
    cam.lookAt(0, lerp(FRAME.centreY, 0.12, k), 0);
    const fov = lerp(FRAME.fov, 32, k);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

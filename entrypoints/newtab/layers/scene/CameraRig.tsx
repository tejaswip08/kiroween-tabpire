import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { cameraDriftInto, fovForAspect } from '../../../../lib/scene/camera';
import type { SceneDisplay } from './display';

const pose = new Float64Array(6);

/** Moves the camera along its slow closed loop and sets the field of view for the window shape. */
export function CameraRig({ display }: { display: SceneDisplay }) {
  const size = useThree((s) => s.size);
  useFrame(({ camera }) => {
    cameraDriftInto(display.time, display.reduced, pose);
    const c = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    c.position.set(pose[0]!, pose[1]!, pose[2]!);
    c.lookAt(pose[3]!, pose[4]!, pose[5]!);
    const fov = fovForAspect(aspect);
    if (c.fov !== fov || c.aspect !== aspect) {
      c.fov = fov;
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
  }, -5);
  return null;
}

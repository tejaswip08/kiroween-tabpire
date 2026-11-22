import { useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { cameraDriftInto, fovForAspect } from '../../../../lib/scene/camera';
import { parallaxOffsets, parallaxTarget, stepParallax, type Spring } from '../../../../lib/scene/parallax';
import { pointer, pointerClock } from '../pointer';
import type { SceneDisplay } from './display';

const pose = new Float64Array(6);
const offs = new Float64Array(4);
const spring: Spring = { x: 0, y: 0, vx: 0, vy: 0 };

/**
 * Moves the camera along its slow closed loop, and glides it a little toward the pointer (mouse
 * parallax). The camera moves, so near things shift across the screen more than far ones. With reduced
 * motion there is no drift and no parallax.
 */
export function CameraRig({ display }: { display: SceneDisplay }) {
  const size = useThree((s) => s.size);
  useFrame(({ camera }, dt) => {
    cameraDriftInto(display.time, display.reduced, pose);
    const target = parallaxTarget(pointer, size.width, size.height, pointerClock(), display.reduced);
    if (display.reduced) {
      spring.x = spring.y = spring.vx = spring.vy = 0;
    } else {
      stepParallax(spring, target, dt);
    }
    parallaxOffsets(spring.x, spring.y, offs);
    const c = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    c.position.set(pose[0]! + offs[0]!, pose[1]! + offs[1]!, pose[2]!);
    c.lookAt(pose[3]! + offs[2]!, pose[4]! + offs[3]!, pose[5]!);
    const fov = fovForAspect(aspect);
    if (c.fov !== fov || c.aspect !== aspect) {
      c.fov = fov;
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
  }, -5);
  return null;
}

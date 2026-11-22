import { createContext, useContext } from 'react';
import { Vector3 } from 'three';
import type { SceneState } from '../../../../lib/scene/meaning';

/**
 * What the scene shows right now. One mutable object, updated once per frame by the
 * driver and read by every part of the scene, so nothing is created inside the frame loop.
 */
export interface SceneDisplay {
  /** Seconds of animation time. Stays 0 with reduced motion. */
  time: number;
  reduced: boolean;
  aspect: number;
  /** Counts as smooth numbers, so things fade and rise in and out. */
  ghosts: number;
  bats: number;
  candles: number;
  newGraves: number;
  coffins: number;
  haloPeriodS: number;
  haloAmplitude: number;
  /** Phase of the moon pulse, in radians. */
  haloPhase: number;
  /** Sine of the phase: the pulse from -1 to 1. */
  haloPulse: number;
  fogFactor: number;
  emberRate: number;
  /** Ember burst from a Dawn, from 1 down to 0. */
  burst: number;
  /** True while Dawn would close at least one tab. */
  witch: boolean;
  /** Moon direction and the right and up directions around it, for the current window shape. */
  moon: Vector3;
  moonRight: Vector3;
  moonUp: Vector3;
  /** Raised each time the window shape changes, so parts can refresh what depends on it. */
  shapeVersion: number;
  /** Set when props change, so the shadows refresh at once. */
  shadowDirty: boolean;
}

export function createDisplay(target: SceneState, reduced: boolean): SceneDisplay {
  return {
    time: 0,
    reduced,
    aspect: 16 / 9,
    ghosts: target.ghosts,
    bats: target.bats,
    candles: target.candles,
    newGraves: target.newGraves,
    coffins: target.coffins,
    haloPeriodS: target.haloPeriodS,
    haloAmplitude: target.haloAmplitude,
    haloPhase: 0,
    haloPulse: 0,
    fogFactor: target.fogFactor,
    emberRate: target.emberRate,
    burst: 0,
    witch: target.witch,
    moon: new Vector3(0.5, 0.2, -0.8),
    moonRight: new Vector3(1, 0, 0),
    moonUp: new Vector3(0, 1, 0),
    shapeVersion: 0,
    shadowDirty: true,
  };
}

export const DisplayContext = createContext<SceneDisplay | null>(null);

export function useDisplay(): SceneDisplay {
  const d = useContext(DisplayContext);
  if (!d) throw new Error('useDisplay needs a scene');
  return d;
}

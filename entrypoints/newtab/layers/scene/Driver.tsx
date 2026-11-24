import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { onSceneEvent } from '../../../../lib/scene/bus';
import { LOOK } from '../../../../lib/scene/config';
import { approach, sceneState, type SceneInputs } from '../../../../lib/scene/meaning';
import { aimMoon, type SceneDisplay } from './display';

const EASE = LOOK.stateEaseRate;
/** A number within this of its target snaps to it, so easing ends and frames can be saved. */
const SNAP = 0.002;

function follow(current: number, target: number, dt: number): number {
  const next = approach(current, target, dt, EASE);
  return Math.abs(next - target) < SNAP ? target : next;
}

/**
 * Moves the shown numbers toward what the data says, advances the animation time and
 * keeps the moon direction right for the window shape. It runs before everything else.
 */
export function SceneDriver({ inputs, display }: { inputs: SceneInputs; display: SceneDisplay }) {
  const target = useMemo(() => sceneState(inputs), [inputs]);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  // The moon sits where the window leaves room for it, so its direction depends on the shape.
  useEffect(() => {
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
    aimMoon(display, aspect);
    invalidate();
  }, [size.width, size.height, display, invalidate]);

  // With reduced motion the numbers jump to their targets, and the scene draws once.
  useEffect(() => {
    if (!display.reduced) return;
    display.ghosts = target.ghosts;
    display.bats = target.bats;
    display.candles = target.candles;
    display.newGraves = target.newGraves;
    display.coffins = target.coffins;
    display.haloPeriodS = target.haloPeriodS;
    display.haloAmplitude = target.haloAmplitude;
    display.fogFactor = target.fogFactor;
    display.emberRate = target.emberRate;
    display.witch = target.witch;
    display.shadowDirty = true;
    invalidate();
  }, [target, display, invalidate]);

  useEffect(
    () =>
      onSceneEvent((e) => {
        if (e.type === 'dawn') display.burst = 1;
        else if (e.type === 'stake') display.burst = Math.max(display.burst, 0.3);
        invalidate();
      }),
    [display, invalidate],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    display.witch = target.witch;
    if (display.reduced) {
      display.time = 0;
      display.haloPulse = 0;
      display.burst = 0;
      return;
    }
    display.time += dt;
    display.ghosts = follow(display.ghosts, target.ghosts, dt);
    display.bats = follow(display.bats, target.bats, dt);
    display.candles = follow(display.candles, target.candles, dt);
    display.newGraves = follow(display.newGraves, target.newGraves, dt);
    display.coffins = follow(display.coffins, target.coffins, dt);
    display.haloPeriodS = follow(display.haloPeriodS, target.haloPeriodS, dt);
    display.haloAmplitude = follow(display.haloAmplitude, target.haloAmplitude, dt);
    display.fogFactor = follow(display.fogFactor, target.fogFactor, dt);
    display.emberRate = follow(display.emberRate, target.emberRate, dt);
    display.haloPhase = (display.haloPhase + (dt * 2 * Math.PI) / display.haloPeriodS) % (2 * Math.PI);
    display.haloPulse = Math.sin(display.haloPhase);
    display.burst = Math.max(0, display.burst - dt / 3.2);
  }, -10);

  return null;
}

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { VampireState } from '../../../../lib/hunger';
import { takeTransition } from '../../../../lib/scene/exitKinds';
import { DAWN_STAGGER_MS, EXIT_MS } from '../../../../lib/vampire/exits';
import { useReducedMotion } from '../motion';
import type { ExitRun } from './shared';
import type { CardSlot } from './useCardSlots';

/** Which dawn position a card has, worked out from how long it was told to stay. */
export function dawnOrderFromMs(exitMs: number): number {
  return Math.max(0, Math.round((exitMs - EXIT_MS.dawn) / DAWN_STAGGER_MS));
}

/**
 * Starts the exit that matches what the page says. A card that is leaving carries `data-exit`
 * (stake, dawn, crypt, or none for a tab closed elsewhere). A card that turns Asleep right after
 * the Coffin action plays the Coffin transition. With reduced motion nothing plays.
 */
export function useExitTriggers(slot: CardSlot, run: MutableRefObject<ExitRun | null>): void {
  const reduced = useReducedMotion();
  const prevState = useRef<VampireState>(slot.state);

  useEffect(() => {
    if (reduced || !slot.exitKind || run.current) return;
    run.current = { kind: slot.exitKind, t0: performance.now(), order: slot.exitKind === 'dawn' ? dawnOrderFromMs(slot.exitMs) : 0, idle: null };
  }, [slot.exitKind, slot.exitMs, reduced, run]);

  useEffect(() => {
    const before = prevState.current;
    prevState.current = slot.state;
    if (slot.state !== 'asleep' || before === 'asleep') return;
    // Always use up the mark, so an old one cannot start a later transition.
    const mark = takeTransition(slot.id);
    if (mark === 'coffin' && !reduced && !run.current) {
      run.current = { kind: 'coffin', t0: performance.now(), order: 0, idle: null };
    }
  }, [slot.state, slot.id, reduced, run]);
}

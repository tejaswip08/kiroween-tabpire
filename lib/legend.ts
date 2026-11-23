// Counts and filtering for the state legend. Pure.
import type { VampireState } from './hunger';
import { STATE_ORDER } from './vampireVoice';

export type StateCounts = Record<VampireState, number>;

export function countByState(cards: readonly { state: VampireState }[]): StateCounts {
  const counts: StateCounts = { awake: 0, starving: 0, asleep: 0, protected: 0 };
  for (const c of cards) counts[c.state]++;
  return counts;
}

/** Only the cards in one state, or all of them when there is no filter. The order is kept. */
export function filterByState<T extends { state: VampireState }>(cards: readonly T[], filter: VampireState | null): T[] {
  return filter === null ? [...cards] : cards.filter((c) => c.state === filter);
}

/** Clicking the chip of the state that is already chosen clears the filter. */
export function toggleFilter(current: VampireState | null, clicked: VampireState): VampireState | null {
  return current === clicked ? null : clicked;
}

export { STATE_ORDER };

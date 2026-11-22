import { dawnTargets } from '../../../lib/hunger';
import { emitSceneEvent } from '../../../lib/scene/bus';
import { markExit, markTransition, unmarkExit, unmarkTransition } from '../../../lib/scene/exitKinds';
import type { Card } from '../../../lib/view';
import type { CardAction } from '../components/TabCard';

/**
 * Tells the exit system which action is about to close (or change) a card. It runs
 * BEFORE the action, because the browser reports the closed tab while the action runs.
 * With reduced motion nothing is marked, so cards leave at once.
 * Returns a function that takes the mark back if the action fails.
 */
export function markActionExit(action: CardAction, tabId: number, reduced: boolean): () => void {
  if (reduced) return () => {};
  switch (action) {
    case 'stake':
    case 'crypt':
      markExit(tabId, action);
      return () => unmarkExit(tabId);
    case 'coffin':
      markTransition(tabId, 'coffin');
      return () => unmarkTransition(tabId);
    default:
      return () => {};
  }
}

/** Sends the one-off event for a successful action to the scene. */
export function announceAction(action: CardAction): void {
  if (action === 'stake' || action === 'crypt' || action === 'coffin') emitSceneEvent({ type: action });
}

/**
 * Marks every card Dawn is about to close, in card order, so their burns are staggered.
 * Returns the tab ids in that order and a function that takes the marks back.
 */
export function markDawnExits(cards: readonly Card[], garlic: readonly string[], now: number, reduced: boolean): { ids: number[]; undo: () => void } {
  const targets = new Set(dawnTargets(cards.map((c) => c.info), garlic, now).map((i) => i.id));
  const ids = cards.filter((c) => targets.has(c.tab.id)).map((c) => c.tab.id);
  if (reduced) return { ids, undo: () => {} };
  ids.forEach((id, order) => markExit(id, 'dawn', order));
  return { ids, undo: () => ids.forEach(unmarkExit) };
}

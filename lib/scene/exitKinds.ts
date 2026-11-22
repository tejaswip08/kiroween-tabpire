// Remembers which card is leaving because of which action, so the portrait can play
// the right exit. The page marks a tab when an action succeeds; the card reads the
// mark once when it disappears.

export type ExitKind = 'stake' | 'dawn' | 'crypt' | 'none';
export interface ExitMark {
  kind: Exclude<ExitKind, 'none'>;
  /** Position among the cards that leave together (Dawn staggers by this). */
  order: number;
  at: number;
}
export type Transition = 'coffin';

const MARK_LIFE_MS = 10_000;
const exits = new Map<number, ExitMark>();
const transitions = new Map<number, { kind: Transition; at: number }>();

export function markExit(tabId: number, kind: ExitMark['kind'], order = 0, now = Date.now()): void {
  exits.set(tabId, { kind, order, at: now });
}

/** Reads a mark without using it up. Safe to call while rendering. */
export function peekExit(tabId: number, now = Date.now()): ExitMark | undefined {
  const mark = exits.get(tabId);
  return mark && now - mark.at <= MARK_LIFE_MS ? mark : undefined;
}
/** Returns the mark once, and forgets it. Old marks are ignored. */
export function takeExit(tabId: number, now = Date.now()): ExitMark | undefined {
  const mark = exits.get(tabId);
  exits.delete(tabId);
  return mark && now - mark.at <= MARK_LIFE_MS ? mark : undefined;
}

export function markTransition(tabId: number, kind: Transition, now = Date.now()): void {
  transitions.set(tabId, { kind, at: now });
}

export function takeTransition(tabId: number, now = Date.now()): Transition | undefined {
  const mark = transitions.get(tabId);
  transitions.delete(tabId);
  return mark && now - mark.at <= MARK_LIFE_MS ? mark.kind : undefined;
}

/** Forgets a mark when the action did not succeed. */
export function unmarkExit(tabId: number): void {
  exits.delete(tabId);
}
export function unmarkTransition(tabId: number): void {
  transitions.delete(tabId);
}
export function clearMarks(): void {
  exits.clear();
  transitions.clear();
}

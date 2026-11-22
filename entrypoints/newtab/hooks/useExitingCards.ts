import { useEffect, useRef, useState } from 'react';
import { peekExit, takeExit, type ExitKind } from '../../../lib/scene/exitKinds';
import { CARD_FADE_MS, exitDurationMs } from '../../../lib/vampire/exits';
import type { Card } from '../../../lib/view';

/** How long a card leaves when no Tabpire action closed it (fade and sink). */
export const EXIT_MS = exitDurationMs('none');

export interface DisplayCard {
  card: Card;
  exiting: boolean;
  /** Which action the card is leaving by, when it is exiting. */
  exitKind?: ExitKind;
  /** How long the ghost stays on screen, in milliseconds. */
  exitMs?: number;
  /** Wait before the card body starts to fade, so the portrait animation can play. */
  exitFadeDelayMs?: number;
}

interface Ghost {
  card: Card;
  index: number;
  kind: ExitKind;
  ms: number;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Keeps a removed card on screen for one exit animation, at its old position.
 * With reduced motion the card disappears at once.
 */
export function useExitingCards(cards: Card[]): DisplayCard[] {
  const [previous, setPrevious] = useState<Card[]>(cards);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  // Derive ghosts while rendering, so a removed card never has a frame without itself.
  if (cards !== previous) {
    setPrevious(cards);
    const nowIds = new Set(cards.map((c) => c.tab.id));
    const reduced = prefersReducedMotion();
    const removed: Ghost[] = previous.flatMap((card, index) => {
      if (nowIds.has(card.tab.id)) return [];
      // Only look at the mark here. Rendering must not change anything. The effect below uses it up.
      if (reduced) return [];
      const mark = peekExit(card.tab.id);
      const kind: ExitKind = mark?.kind ?? 'none';
      return [{ card, index, kind, ms: exitDurationMs(kind, mark?.order ?? 0) }];
    });
    setGhosts((current) => [
      ...current.filter((g) => !nowIds.has(g.card.tab.id)),
      ...removed.filter((g) => !current.some((c) => c.card.tab.id === g.card.tab.id)),
    ]);
  }

  const scheduled = useRef(new Set<number>());
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ghost of ghosts) {
      const id = ghost.card.tab.id;
      if (scheduled.current.has(id)) continue;
      scheduled.current.add(id);
      takeExit(id);
      timers.push(
        setTimeout(() => {
          scheduled.current.delete(id);
          setGhosts((current) => current.filter((g) => g.card.tab.id !== id));
        }, ghost.ms),
      );
    }
    // Timers are left running on re-render on purpose. They end by themselves.
    return undefined;
  }, [ghosts]);

  const display: DisplayCard[] = cards.map((card) => ({ card, exiting: false }));
  for (const ghost of [...ghosts].sort((a, b) => a.index - b.index)) {
    display.splice(Math.min(ghost.index, display.length), 0, {
      card: ghost.card,
      exiting: true,
      exitKind: ghost.kind,
      exitMs: ghost.ms,
      exitFadeDelayMs: Math.max(0, ghost.ms - CARD_FADE_MS),
    });
  }
  return display;
}

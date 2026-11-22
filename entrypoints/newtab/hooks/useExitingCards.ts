import { useEffect, useRef, useState } from 'react';
import type { Card } from '../../../lib/view';

export const EXIT_MS = 220;

export interface DisplayCard {
  card: Card;
  exiting: boolean;
}

interface Ghost {
  card: Card;
  index: number;
}

function prefersReducedMotion(): boolean {
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
    const removed: Ghost[] = prefersReducedMotion()
      ? []
      : previous.flatMap((card, index) => (nowIds.has(card.tab.id) ? [] : [{ card, index }]));
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
      timers.push(
        setTimeout(() => {
          scheduled.current.delete(id);
          setGhosts((current) => current.filter((g) => g.card.tab.id !== id));
        }, EXIT_MS),
      );
    }
    // Timers are left running on re-render on purpose. They end by themselves.
    return undefined;
  }, [ghosts]);

  const display: DisplayCard[] = cards.map((card) => ({ card, exiting: false }));
  for (const ghost of [...ghosts].sort((a, b) => a.index - b.index)) {
    display.splice(Math.min(ghost.index, display.length), 0, { card: ghost.card, exiting: true });
  }
  return display;
}
